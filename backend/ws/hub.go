package ws

import (
	"log"
	"sync"
	"time"

	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/gorilla/websocket"
)

type Client struct {
	Hub             *Hub
	Conn            *websocket.Conn
	Send            chan models.WebSocketMessage
	UserID          uint
	Username        string
	SessionID       string
	IsAuthenticated bool
}

type Hub struct {
	Clients      map[*Client]models.UserStatus
	UserClients  map[uint][]*Client
	Broadcast    chan models.WebSocketMessage
	Register     chan *Client
	Unregister   chan *Client
	Mutex        sync.RWMutex
	UserStatuses map[uint]*models.UserStatusMessage
}

func NewHub() *Hub {
	hub := &Hub{
		Broadcast:    make(chan models.WebSocketMessage),
		Register:     make(chan *Client),
		Unregister:   make(chan *Client),
		Clients:      make(map[*Client]models.UserStatus),
		UserClients:  make(map[uint][]*Client),
		UserStatuses: make(map[uint]*models.UserStatusMessage),
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

		case <-ticker.C:
			h.broadcastOnlineUsers()
		}
	}
}

func (h *Hub) handleRegister(client *Client) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	h.Clients[client] = models.Online

	if _, exists := h.UserClients[client.UserID]; !exists {
		h.UserClients[client.UserID] = []*Client{}
	}
	h.UserClients[client.UserID] = append(h.UserClients[client.UserID], client)

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

	log.Printf("User %s connected. Sessions: %d", client.Username, len(h.UserClients[client.UserID]))
	h.broadcastUserStatus(client.UserID, models.Online)
	h.sendOnlineUsersToClient(client)
}

func (h *Hub) handleUnregister(client *Client) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	if _, ok := h.Clients[client]; ok {
		delete(h.Clients, client)
		close(client.Send)
	}

	if sessions, exists := h.UserClients[client.UserID]; exists {
		for i, c := range sessions {
			if c.SessionID == client.SessionID {
				h.UserClients[client.UserID] = append(sessions[:i], sessions[i+1:]...)
				break
			}
		}

		if len(h.UserClients[client.UserID]) == 0 {
			delete(h.UserClients, client.UserID)

			if status, exists := h.UserStatuses[client.UserID]; exists {
				status.Status = models.Offline
				status.LastSeen = time.Now()
			}

			h.updateUserOnlineStatus(client.UserID, models.Offline)
			h.broadcastUserStatus(client.UserID, models.Offline)
		}
	}

	log.Printf("User %s disconnected. Remaining sessions: %d", client.Username, len(h.UserClients[client.UserID]))
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
	for client := range h.Clients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(h.Clients, client)
		}
	}
}

func (h *Hub) IsUserOnline(userID uint) bool {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	sessions, exists := h.UserClients[userID]
	return exists && len(sessions) > 0
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

func (c *Client) ReadPump() {

}

func (c *Client) WritePump() {

}
