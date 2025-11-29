package models

import "time"

type UserStatus string

const (
	Online  UserStatus = "online"
	Offline UserStatus = "offline"
	Busy    UserStatus = "busy"
)

type User struct {
	Id        uint       `json:"id" gorm:"primaryKey;column:id"`
	Name      string     `json:"name" binding:"required" gorm:"uniqueIndex;column:name"`
	Email     string     `json:"email" binding:"required" gorm:"uniqueIndex;column:email"`
	Password  string     `json:"-" gorm:"column:password"` // do not expose password in JSON
	Status    UserStatus `json:"status" gorm:"column:status;default:'offline'"`
	AvatarUrl *string    `json:"avatarUrl,omitempty" gorm:"column:avatar_url"`
	LastSeen  time.Time  `json:"lastSeen" gorm:"column:last_seen"`
}

type UserStatusMessage struct {
	UserID   uint       `json:"user_id"`
	Username string     `json:"username"`
	Status   UserStatus `json:"status"`
	LastSeen time.Time  `json:"last_seen,omitempty"`
}

