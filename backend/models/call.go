package models

import "time"

type CallStatus string

const (
	Ringing CallStatus = "ringing"
	Ongoing CallStatus = "ongoing"
	Ended CallStatus = "ended"
	Missed CallStatus = "missed"
)

type Call struct {
	id int
	callerId string
	calleeId string
	startTime time.Time
	endTime *time.Time
	status CallStatus
	offer *RTCSessionDescriptionInit
	answer *RTCSessionDescriptionInit
}

// RTCSessionDescriptionInit represents the initialization data for an RTC session description.
type RTCSessionDescriptionInit struct {
	Type string    `json:"type"`
	SDP  string    `json:"sdp"`
}