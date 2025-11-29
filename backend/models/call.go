package models

import (
	"encoding/json"
	"time"
)

type CallStatus string

const (
	Ringing CallStatus = "ringing"
	Ongoing CallStatus = "ongoing"
	Ended   CallStatus = "ended"
	Missed  CallStatus = "missed"
)

type Call struct {
	Id        uint            `json:"id" gorm:"primaryKey;column:id"`
	CallerId  uint            `json:"callerId" gorm:"column:caller_id"`
	CalleeIds []uint          `json:"calleeIds" gorm:"-"`
	StartTime time.Time       `json:"startTime" gorm:"column:start_time"`
	EndTime   *time.Time      `json:"endTime,omitempty" gorm:"column:end_time"`
	Status    CallStatus      `json:"status" gorm:"column:status"`
	Offer     json.RawMessage `json:"offer,omitempty" gorm:"type:text;column:offer"`   // store JSON text
	Answer    json.RawMessage `json:"answer,omitempty" gorm:"type:text;column:answer"` // store JSON text
	// midToBId left out of DB mapping (in-memory only)
}
