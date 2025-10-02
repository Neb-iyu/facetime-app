package models

import "time"

type UserStatus string

const (
	Online  UserStatus = "online"
	Offline UserStatus = "offline"
	Busy    UserStatus = "busy"
)

type User struct {
	Id        int `json:"id" gorm:"primaryKey"`
	Name      string `json:"name" binding:"required" gorm:"uniqueIndex"`
	Email     string `json:"email" binding:"required" gorm:"uniqueIndex"`
	Status    UserStatus `json:"status" gorm:"default:'offline'"`
	AvatarUrl *string `json:"avatar_url"`
	LastSeen  time.Time `json:"last_seen"`
}

type UserStatusMessage struct {
	UserID   uint       `json:'user_id'`
	Username string     `json:'username'`
	Status   UserStatus `json:'status'`
	LastSeen time.Time  `json:'last_seen,omitempty'`
}

type UserContact struct {
	UserId    string
	ContactId string
}
