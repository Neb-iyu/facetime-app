package models

import "time"

type History struct {
	Id      uint       `json:"id" gorm:"primaryKey;column:id"`
	UserId  uint       `json:"userId" gorm:"column:user_id"`
	CallId  uint       `json:"callId" gorm:"column:call_id"`
	Status  CallStatus `json:"status" gorm:"column:status"`
	Role    string     `json:"role" gorm:"column:role"`
	EndTime time.Time  `json:"endTime" gorm:"column:end_time"`
}
