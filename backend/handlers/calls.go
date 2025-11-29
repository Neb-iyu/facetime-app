package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/gin-gonic/gin"
)

// createCallPayload no longer accepts callerId from client; caller is authenticated user.
type createCallPayload struct {
	CalleeIds []uint `json:"calleeIds"`
	Options   any    `json:"options"`
}

func CreateCall(c *gin.Context) {
	var p createCallPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ai, ok := c.Get("authUser")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}
	authUser := ai.(models.User)

	call := models.Call{
		CallerId:  authUser.Id,
		CalleeIds: p.CalleeIds,
		StartTime: time.Now(),
		Status:    models.Ringing,
	}
	if err := database.Db.Create(&call).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create call"})
		return
	}
	if wsHub != nil {
		wsHub.CreateCallSession(&call)
	}
	c.JSON(http.StatusCreated, call)
}

func GetCall(c *gin.Context) {
	id := c.Param("id")
	var call models.Call
	if err := database.Db.First(&call, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "call not found"})
		return
	}
	c.JSON(http.StatusOK, call)
}

func JoinCall(c *gin.Context) {
	callId := c.Param("id")
	ai, ok := c.Get("authUser")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}
	authUser := ai.(models.User)

	// optional: record join in DB
	_ = callId
	_ = authUser
	c.Status(http.StatusOK)
}

func AcceptCall(c *gin.Context) {
	callId := c.Param("id")
	ai, ok := c.Get("authUser")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}
	authUser := ai.(models.User)

	// notify via wsHub if set
	if wsHub != nil {
		// broadcast accepted event to other participants (implement hub helper)
		//wsHub.BroadcastToCallExcept(uint(0), uint(0)) // placeholder - adapt as needed
		_ = callId
		_ = authUser
	}
	c.Status(http.StatusOK)
}

func LeaveCall(c *gin.Context) {
	// the authenticated user leaves current call
	ai, ok := c.Get("authUser")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}
	_ = ai.(models.User)
	c.Status(http.StatusNoContent)
}

func EndCall(c *gin.Context) {
	id := c.Param("id")
	if err := database.Db.Model(&models.Call{}).Where("id = ?", id).Update("status", models.Ended).Error; err != nil {
		log.Printf("end call error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to end call"})
		return
	}
	c.Status(http.StatusNoContent)
}

func GetCallParticipants(c *gin.Context) {
	callId := c.Param("id")
	// TODO: implement query to join call participants table; returning placeholder for now
	var participants []map[string]any
	participants = append(participants, map[string]any{"userId": 1, "status": "connected"})
	_ = callId
	c.JSON(http.StatusOK, participants)
}

// media control endpoints (placeholders)
func PublishTrack(c *gin.Context) {
	callId := c.Param("id")
	var p struct {
		PublisherId uint   `json:"publisherId"`
		TrackId     string `json:"trackId"`
	}
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// route to ws hub / call session to create TrackLocal etc.
	if wsHub != nil {
		_ = callId
		_ = p
		// TODO: call wsHub or call session PublishTrack
	}
	c.Status(http.StatusOK)
}

func Renegotiate(call *gin.Context) {
	c := call
	callId := c.Param("id")
	var p struct {
		TargetUserId *uint `json:"targetUserId"`
	}
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_ = callId
	// TODO: enqueue renegotiation via wsHub
	c.Status(http.StatusAccepted)
}
