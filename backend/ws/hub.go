package ws

import (
	"log"
	"sync"
	"time"

	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/models"
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
	Calls         map[uint]*models.Call
}

func NewHub() *Hub {
	hub := &Hub{
		Broadcast:    make(chan models.WebSocketMessage),
		Register:     make(chan *Client),
		Unregister:   make(chan *Client),
		UserClients:  make(map[uint]*Client),
		UserStatuses: make(map[uint]*models.UserStatusMessage),
		Calls:        make(map[uint]*models.Call),
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

	log.Printf("User %s disconnected.", client.Username)
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
	case "call_ended":
		h.handleCallEnded(msg)
	case "ice":

	default:
		h.broadcastMessage(msg)
	}

}

func (h *Hub) handleIncomingCall(msg models.WebSocketMessage) {
	db := database.Db
	call, ok := msg.Payload.(models.Call)
	if !ok {
		log.Printf("Failed to assert msg.Payload as models.Call")
		return
	}
	//if h.UserStatuses[call.CalleeId].Status != models.Online {
	//TODO: handle busy and offline

	for _, id := range call.CalleeIds {
		h.UserClients[uint(id)].Send <- msg
	}
	if call.Offer == nil {
		log.Printf("Caller does not have any offer")
		return
	}
	caller := h.UserClients[call.CallerId]
	caller.ProcessOffer(*call.Offer, caller.UserID)
	db.Create(&call)
	h.Calls[uint(call.Id)] = &call

}

func (h *Hub) handleCallAccepted(msg models.WebSocketMessage) {
	type CallAcceptedPayload struct {
		CallId uint   `json:"callId"`
		UserId uint   `json:"userId"`
		Offer  string `json:"offer"`
	}

	payload, ok := msg.Payload.(CallAcceptedPayload)
	if !ok {
		log.Printf("Failed to assert msg.Payload as CallAcceptedPayload")
		return
	}
	if _, ok := h.Calls[payload.CallId]; !ok {
		log.Printf("No call in stack")
		return
	}
	h.UserClients[payload.UserId].ProcessOffer(payload.Offer, h.Calls[payload.CallId].CallerId)

}

func (h *Hub) handleCallRejected(msg models.WebSocketMessage) {
	type CallRejectedPayload struct {
		CallId uint `json:"callId"`
		UserId uint `json:"userId"`
	}
	payload, ok := msg.Payload.(CallRejectedPayload)
	if !ok {
		log.Printf("Failed to assert msg.Payload as CallRejectedPayload")
		return
	}
	call, ok := h.Calls[payload.CallId]
	if !ok {
		log.Printf("No call in stack")
		return
	}
	// Remove payload.UserId from call.CalleeId slice
	newCalleeIds := make([]uint, 0, len(call.CalleeIds))
	for _, id := range call.CalleeIds {
		if id != payload.UserId {
			newCalleeIds = append(newCalleeIds, id)
		}
	}
	call.CalleeIds = newCalleeIds
	caller := h.UserClients[call.CallerId]
	if len(call.CalleeIds) == 0 {
		if caller.PeerConn != nil {
			caller.PeerConn.Close()
		}
		delete(h.Calls, call.Id)
	}
	caller.Send <- msg

}

func (h *Hub) handleCallEnded(msg models.WebSocketMessage) {
	type CallEndedPayload struct {
		CallId uint `json:"callId"`
		UserId uint `json:"userId"`
	}
	payload, ok := msg.Payload.(CallEndedPayload)
	if !ok {
		log.Printf("Couldnt assert msg.Payload as CallEndedPayload")
	}
	call := h.Calls[payload.CallId]
	caller := h.UserClients[call.CallerId]
	if payload.UserId == call.CallerId {
		if caller.PeerConn != nil {
			caller.PeerConn.Close()
		}
		for _, id := range call.CalleeIds {
			h.UserClients[id].Send <- msg
		}
		//Check to see if there is only one user connected
		if len(call.CalleeIds) == 1 {
			h.UserClients[call.CalleeIds[0]].PeerConn.Close()
			delete(h.Calls, call.Id)
		}
	} else {
		if h.UserClients[payload.UserId].PeerConn != nil {
			h.UserClients[payload.UserId].PeerConn.Close()
		}
		newCalleeIds := make([]uint, 0, len(call.CalleeIds))
		for _, id := range call.CalleeIds {
			if id != payload.UserId {
				h.UserClients[id].Send <- msg
				newCalleeIds = append(newCalleeIds, id)
			}
		}
		caller.Send <- msg
		//Check to see if there is only one callee with the caller not connected
		if caller.PeerConn == nil && len(call.CalleeIds) == 1 {
			if h.UserClients[call.CalleeIds[0]].PeerConn != nil {
				h.UserClients[call.CalleeIds[0]].PeerConn.Close()
			}
			delete(h.Calls, call.Id)
		} else if len(call.CalleeIds) == 0 {
			if caller.PeerConn != nil {
				caller.PeerConn.Close()
			}
			delete(h.Calls, call.Id)
		}
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
