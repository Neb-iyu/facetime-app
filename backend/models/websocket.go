package models

import "time"

type WebSocketMessage struct {
	Type    WSMessageType
	Payload interface{} //*UserStatusMessage
	Time    time.Time
}

type WSMessageType string

const (
	MessageTypeUserOnline  WSMessageType = "user_online"
	MessageTypeUserOffline WSMessageType = "user_offline"
	MessageTypeUserBusy    WSMessageType = "user_busy"
	MessageTypeUserStatus  WSMessageType = "user_status"
	MessageTypeUsersList   WSMessageType = "users_list"
)
