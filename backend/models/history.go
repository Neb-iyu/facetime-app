package models

import "time"

type History struct {
	Id      uint
	UserId  uint	`gorm:"foreignKey:UserId"`
	CallId  uint	`gorm:"foreignKey:CallId"`
	Status  CallStatus
	Role	string
	EndTime time.Time
}