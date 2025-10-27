package models

import "time"

type CallStatus string

const (
	Ringing CallStatus = "ringing"
	Ongoing CallStatus = "ongoing"
	Ended 	CallStatus = "ended"
	Missed 	CallStatus = "missed"
)

type Call struct {
	Id		  uint			`gorm:"primaryKey"`
	CallerId  uint			`gorm:"foreignKey:CallerId"`
	CalleeIds []uint		`gorm:"-"`
	StartTime time.Time
	EndTime   *time.Time
	Status 	  CallStatus
	Offer 	  *string 		`gorm:"-"`
	Answer    *string 		`gorm:"-"`
	midToBId  map[int]*int	`gorm:"-"`
}

