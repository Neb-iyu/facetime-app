package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/pion/webrtc/v4"
	//"github.com/Neb-iyu/facetime-app/backend/rtc"
)

type Hub struct {
	UserClients   map[uint]*Client
	Broadcast     chan models.WebSocketMessage
	HandleMessage chan models.WebSocketMessage
	Register      chan *Client
	Unregister    chan *Client
	Mutex         sync.RWMutex
	UserStatuses  map[uint]*models.UserStatusMessage

	// call sessions keyed by call ID
	CallSessions        map[uint]*CallSession
	DisconnectedClients map[uint]*Client // userID -> client (recently disconnected)
}

func NewHub() *Hub {
	hub := &Hub{
		Broadcast:           make(chan models.WebSocketMessage),
		Register:            make(chan *Client),
		Unregister:          make(chan *Client),
		UserClients:         make(map[uint]*Client),
		UserStatuses:        make(map[uint]*models.UserStatusMessage),
		CallSessions:        make(map[uint]*CallSession),
		DisconnectedClients: make(map[uint]*Client),
	}
	hub.InitializeUserStatuses()
	return hub
}

func (h *Hub) InitializeUserStatuses() {
	db := database.Db
	var users []models.User
	if results := db.Find(&users); results.Error != nil {
		log.Printf("Error initializing user statuses: %v", results.Error)
		return
	}

	for _, user := range users {
		h.UserStatuses[uint(user.Id)] = &models.UserStatusMessage{
			UserID:   uint(user.Id),
			Username: user.Name,
			Status:   "offline",
			LastSeen: user.LastSeen,
		}
	}
}

func (h *Hub) Run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case client := <-h.Register:
			h.handleRegister(client)

		case client := <-h.Unregister:
			h.handleUnregister(client)

		case message := <-h.Broadcast:
			h.broadcastMessage(message)

		case message := <-h.HandleMessage:
			h.handleMessage(message)

		case <-ticker.C:
			h.broadcastOnlineUsers()
		}
	}
}

func (h *Hub) handleRegister(client *Client) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	//TODO: if there is already an active session reject

	// if _, exists := h.UserClients[client.UserID]; !exists {
	// 	h.UserClients[client.UserID] = []*Client{}
	// }
	h.UserClients[client.UserID] = client

	if status, exists := h.UserStatuses[client.UserID]; exists {
		status.Status = models.Online
		status.LastSeen = time.Now()
	} else {
		h.UserStatuses[client.UserID] = &models.UserStatusMessage{
			UserID:   client.UserID,
			Username: client.Username,
			Status:   models.Online,
			LastSeen: time.Now(),
		}
	}

	h.updateUserOnlineStatus(client.UserID, models.Online)

	log.Printf("User %s connected.", client.Username)
	h.broadcastUserStatus(client.UserID, models.Online)
	h.sendOnlineUsersToClient(client)
}

func (h *Hub) handleUnregister(client *Client) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	if _, ok := h.UserClients[client.UserID]; ok {
		delete(h.UserClients, client.UserID)
		close(client.Send)
	}

	if status, exists := h.UserStatuses[client.UserID]; exists {
		status.Status = models.Offline
		status.LastSeen = time.Now()
	}

	h.updateUserOnlineStatus(client.UserID, models.Offline)
	h.broadcastUserStatus(client.UserID, models.Offline)
	h.DisconnectedClients[client.UserID] = client

	// schedule cleanup after grace period
	grace := 30 * time.Second
	go func(uid uint, c *Client) {
		time.Sleep(grace)
		h.Mutex.Lock()
		defer h.Mutex.Unlock()
		if _, still := h.DisconnectedClients[uid]; still {
			for _, sess := range h.CallSessions {
				sess.Mu.Lock()
				if _, present := sess.Participants[uid]; present {
					type Payload struct {
						CallId uint `json:"callId"`
						UserId uint `json:"userId"`
					}
					msg := models.WebSocketMessage{
						Type: "user_leave",
						Payload: Payload{
							CallId: sess.ID,
							UserId: uid,
						},
						Time: time.Now(),
					}
					sess.RemoveParticipant(uid, &msg)
				}
				sess.Mu.Unlock()
			}
			delete(h.DisconnectedClients, uid)
			if c.Send != nil {
				close(c.Send)
			}
			// logs
			log.Printf("Cleaned up disconnected client %d after grace period", uid)
		}
	}(client.UserID, client)

	log.Printf("User %s disconnected.", client.Username)
}

// CreateCallSession creates a CallSession for a persisted call and registers participants.
func (h *Hub) CreateCallSession(call *models.Call) *CallSession {

	session := NewCallSession(*call)
	// register participants who are connected
	for _, uid := range append([]uint{call.CallerId}, call.CalleeIds...) {
		if cl, ok := h.UserClients[uid]; ok && h.UserStatuses[uid].Status == models.Online {
			session.Participants[uid] = cl
		}
	}
	h.CallSessions[uint(call.Id)] = session
	return session
}

func (h *Hub) updateUserOnlineStatus(userID uint, status models.UserStatus) {
	db := database.Db
	db.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"status":    status,
		"last_seen": time.Now(),
	})
}

func (h *Hub) broadcastUserStatus(userID uint, status models.UserStatus) {
	if stat, exists := h.UserStatuses[userID]; exists {
		messageType := models.MessageTypeUserOffline
		if status == models.Online {
			messageType = models.MessageTypeUserOnline
		}
		if status == models.Busy {
			messageType = models.MessageTypeUserBusy
		}
		message := models.WebSocketMessage{
			Type:    messageType,
			Payload: stat,
			Time:    time.Now(),
		}

		h.broadcastMessage(message)
	}
}

func (h *Hub) broadcastOnlineUsers() {
	onlineUsers := h.GetOnlineUsers()
	message := models.WebSocketMessage{
		Type:    models.MessageTypeUsersList,
		Payload: onlineUsers,
		Time:    time.Now(),
	}

	h.broadcastMessage(message)
}

func (h *Hub) GetOnlineUsers() []models.UserStatusMessage {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	onlineUsers := make([]models.UserStatusMessage, 0)
	for _, status := range h.UserStatuses {
		if status.Status == "online" {
			onlineUsers = append(onlineUsers, *status)
		}
	}
	return onlineUsers
}

func (h *Hub) GetBusyUsers() []models.UserStatusMessage {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	busyUsers := make([]models.UserStatusMessage, 0)
	for _, status := range h.UserStatuses {
		if status.Status == "busy" {
			busyUsers = append(busyUsers, *status)
		}
	}
	return busyUsers
}

func (h *Hub) CheckUserStatus(userID uint) *models.UserStatusMessage {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	status := h.UserStatuses[userID]
	return status
}

func (h *Hub) sendOnlineUsersToClient(client *Client) {
	onlineUsers := h.GetOnlineUsers()
	message := models.WebSocketMessage{
		Type:    models.MessageTypeUsersList,
		Payload: onlineUsers,
		Time:    time.Now(),
	}

	select {
	case client.Send <- message:
	default:
		h.Unregister <- client
	}
}

func (h *Hub) broadcastMessage(message models.WebSocketMessage) {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	for _, client := range h.UserClients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
		}
	}
}

func (h *Hub) handleMessage(msg models.WebSocketMessage) {
	switch msg.Type {
	case "user_online":
		h.broadcastMessage(msg)
	case "incoming_call":
		h.handleIncomingCall(msg)
	case "call_accepted":
		h.handleCallAccepted(msg)
	case "call_rejected":
		h.handleCallRejected(msg)
	case "user_leave":
		h.handleUserLeft(msg)
	case "add_callee":
		h.handleAddCallee(msg)
	case "ice-candidate":
		h.handleICECandidate(msg)
	case "call_offer":
		h.handleOffer(msg)
	case "track_update":
		h.handleTrackUpdate(msg)
	case "reconnect":
		h.handleReconnect(msg)
	default:
		h.broadcastMessage(msg)
	}

}

func (h *Hub) handleIncomingCall(msg models.WebSocketMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()
	type IncomingCallPayload struct {
		CallId uint `json:"userId"`
		UserId uint `json:"callId"`
	}

	payload, ok := msg.Payload.(IncomingCallPayload)
	if !ok {
		log.Printf("Failed to assert msg.Payload as models.Call")
		return
	}
	session, exists := h.CallSessions[payload.CallId]
	if !exists {
		log.Printf("Call %d doesn't exist", payload.CallId)
		return
	}
	call := session.Call
	caller := h.UserClients[call.CallerId]
	// db.Create(&call)
	// h.CreateCallSession(&call)
	//if h.UserStatuses[call.CalleeId].Status != models.Online {
	//TODO: handle busy and offline
	msg = models.WebSocketMessage{
		Type:    "incoming_call",
		Payload: call,
		Time:    time.Now(),
	}
	for _, id := range call.CalleeIds {
		if h.UserStatuses[id].Status != models.Online {
			log.Printf("User %d is already in a call", id)
			continue
		}
		select {
		case h.UserClients[uint(id)].Send <- msg:
		default:
			log.Printf("Couldn't send user %v the incoming call due to full channel or stg I don't no", id)
		}
	}
	if call.Offer == nil {
		log.Printf("Caller does not have any offer")
		return
	}
	caller.ProcessOffer(call.Offer, call.Id)
	h.updateUserOnlineStatus(call.CallerId, models.Busy)
	h.broadcastUserStatus(call.CallerId, models.Busy)

}

func (h *Hub) handleOffer(msg models.WebSocketMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	type OfferPayload struct {
		CallId uint            `json:"callId"`
		UserId uint            `json:"userId"`
		Offer  json.RawMessage `json:"offer"`
	}

	payload, ok := msg.Payload.(OfferPayload)
	if !ok {
		log.Printf("handleOffer: Could not assert msg.Payload as OfferPayload")
		return
	}
	if _, exists := h.CallSessions[payload.CallId]; !exists {
		log.Printf("handleOffer: Call %d session does not exist", payload.CallId)
	}
	cl, exists := h.UserClients[payload.UserId]
	if !exists {
		log.Printf("handleOffer: User %d is not found", payload.UserId)
		return
	}
	cl.ProcessOffer(payload.Offer, payload.CallId)
	h.updateUserOnlineStatus(payload.UserId, models.Busy)
	h.broadcastUserStatus(payload.UserId, models.Busy)
}

func (h *Hub) handleCallAccepted(msg models.WebSocketMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	type CallAcceptedPayload struct {
		CallId uint            `json:"callId"`
		UserId uint            `json:"userId"`
		Offer  json.RawMessage `json:"offer"`
	}

	payload, ok := msg.Payload.(CallAcceptedPayload)
	if !ok {
		log.Printf("Failed to assert msg.Payload as CallAcceptedPayload")
		return
	}
	if !ok {
		log.Printf("No call in stack")
		return
	}
	h.UserClients[payload.UserId].ProcessOffer(payload.Offer, payload.CallId)

	h.updateUserOnlineStatus(payload.UserId, models.Busy)
	h.broadcastUserStatus(payload.UserId, models.Busy)
}

func (h *Hub) handleCallRejected(msg models.WebSocketMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	type CallRejectedPayload struct {
		CallId uint `json:"callId"`
		UserId uint `json:"userId"`
	}
	payload, ok := msg.Payload.(CallRejectedPayload)
	if !ok {
		log.Printf("Failed to assert msg.Payload as CallRejectedPayload")
		return
	}
	if !ok {
		log.Printf("No call in stack")
		return
	}
	session := h.CallSessions[payload.CallId]
	db := database.Db
	history := models.History{
		Id:      0,
		UserId:  payload.UserId,
		CallId:  session.ID,
		Status:  models.Missed,
		Role:    "callee",
		EndTime: time.Now(),
	}
	db.Create(&history)
	session.RemoveParticipant(payload.UserId, nil)

	if len(session.Participants) == 1 {
		session.Call.Status = models.Missed
		t := time.Now()
		session.Call.EndTime = &t
		db.Save(session.Call)
		session.Close()
	}

	caller := session.Participants[session.Call.CallerId]
	caller.Send <- msg

}

func (h *Hub) handleUserLeft(msg models.WebSocketMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()
	db := database.Db
	type UserLeftPayload struct {
		CallId uint `json:"callId"`
		UserId uint `json:"userId"`
	}
	payload, ok := msg.Payload.(UserLeftPayload)
	if !ok {
		log.Printf("Couldn't assert msg.Payload as CallEndedPayload")
	}
	session := h.CallSessions[payload.CallId]

	role := "callee"
	if session.Call.CallerId == payload.UserId {
		role = "caller"
	}

	history := models.History{
		Id:      0,
		UserId:  payload.UserId,
		CallId:  session.ID,
		Status:  models.Ended,
		Role:    role,
		EndTime: time.Now(),
	}
	db.Create(&history)

	session.RemoveParticipant(payload.UserId, &msg)
	if len(session.Participants) == 1 {
		session.Close()
		t := time.Now()
		session.Call.EndTime = &t
		db.Save(&session.Call)
	}
	h.updateUserOnlineStatus(payload.UserId, models.Online)
	h.broadcastUserStatus(payload.UserId, models.Online)
}

func (h *Hub) handleAddCallee(msg models.WebSocketMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	type AddCalleePayload struct {
		CallId uint `json:"callId"`
		UserId uint `json:"userId"`
	}
	payload, ok := msg.Payload.(AddCalleePayload)
	if !ok {
		log.Printf("Couldn't assert msg.Payload as AddCalleePayload")
		return
	}
	session, exists := h.CallSessions[payload.CallId]
	if !exists {
		log.Printf("Call session %d does not exist", payload.CallId)
		return
	}
	client, exists := h.UserClients[payload.UserId]
	if !exists {
		log.Printf("User %d not found in client struct", payload.UserId)
		return
	}
	session.AddParticipant(client)
	msg = models.WebSocketMessage{
		Type:    "incoming_call",
		Payload: session.Call,
		Time:    time.Now(),
	}
	select {
	case client.Send <- msg:
	default:

	}
}

func (h *Hub) handleICECandidate(msg models.WebSocketMessage) {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	type ICECandidatePayload struct {
		UserId    uint                    `json:"userId"`
		Candidate webrtc.ICECandidateInit `json:"candidate"`
		CallId    uint                    `json:"callId"`
	}
	payload, ok := msg.Payload.(ICECandidatePayload)
	if !ok {
		log.Printf("Couldn't assert msg.Payload as ICECandidatePayload")
		return
	}
	if payload.CallId != 0 {
		if session, exists := h.CallSessions[payload.CallId]; exists {
			if client, exists := session.Participants[payload.UserId]; exists {
				if client.PeerConn != nil {
					if err := client.PeerConn.AddICECandidate(payload.Candidate); err != nil {
						log.Printf("Failed to add ICE candidate: %v", err)
					}
				}
			} else {
				log.Printf("User %d not part of call %d.", payload.UserId, payload.CallId)
			}
		}
	}
}

func (h *Hub) handleTrackUpdate(msg models.WebSocketMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()
	type TrackUpdatePayload struct {
		CallId uint `json:"callId"`
		UserId uint `json:"userId"`
		TrackType string `json:"trackType"`
		Muted bool `json:"muted"` 
	}
	payload, ok := msg.Payload.(TrackUpdatePayload)
	if !ok {
		log.Printf("Could not assert msg payload as TrackUpdatePayload")
		return
	}
	session := h.CallSessions[payload.CallId]
	for _, c := range session.Participants {
		if c.UserID == payload.UserId {
			continue
		}
		select {
		case c.Send <- msg:
		default:

		}
	}
}

func (h *Hub) handleReconnect(msg models.WebSocketMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()
	type ReconnectPayload struct {
		CallId  uint `json:"callId"`
		UserId  uint `json:"userId"`
		PcAlive bool `json:"pcAlive"`
	}
	payload, ok := msg.Payload.(ReconnectPayload)
	if !ok {
		log.Printf("Could not assert message payload as ReconnectPayload")
		return
	}
	client, exists := h.UserClients[payload.UserId]
	if !exists {
		if c, ok := h.DisconnectedClients[payload.UserId]; ok {
			client = c
			h.UserClients[payload.UserId] = client
			delete(h.DisconnectedClients, payload.UserId)
		} else {
			log.Printf("reconnect: no client object for user %d", payload.UserId)
			return
		}
	} else {
		delete(h.DisconnectedClients, payload.UserId)
	}

	session, ok := h.CallSessions[payload.CallId]
	if !ok {
		log.Printf("reconnect: no call session: %d", payload.CallId)
		return
	}
	session.AddParticipant(client)
	if payload.PcAlive {
		go func() {
			if err := session.RenegotiateParticipant(client); err != nil {
				log.Printf("reconnect: renegotiate error for %d: %v", client.UserID, err)
			}
		}()
	}
}
func (h *Hub) IsUserOnline(userID uint) bool {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	_, exists := h.UserClients[userID]
	return exists
}

func (h *Hub) GetOnlineUsersCount() int {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	count := 0
	for _, status := range h.UserStatuses {
		if status.Status == "online" {
			count++
		}
	}
	return count
}
