package handlers

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/gin-gonic/gin"
)

func GetHistory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var history models.Call
	db := database.Db

	if result := db.First(&history, id); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "History not found"})
		return
	}

	c.JSON(http.StatusOK, history)
}

func AddHistory(c *gin.Context) {
	var history models.Call
	if err := c.ShouldBindJSON(&history); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := database.Db
	if result := db.Create(&history); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusCreated, history)
}

// GetUserHistory: if :id == "me" return current user's history, otherwise return requested user's history (admin)
func GetUserHistory(c *gin.Context) {
	idParam := c.Param("id")
	var targetUserId uint64
	if idParam == "me" {
		ai, ok := c.Get("authUser")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
			return
		}
		authUser := ai.(models.User)
		targetUserId = uint64(authUser.Id)
	} else {
		uid, err := strconv.ParseUint(idParam, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		targetUserId = uid
	}

	db := database.Db
	var history []models.Call

	rows, err := db.Raw(
		"SELECT c.id, c.caller_id, c.start_time, h.end_time FROM calls c JOIN history h on h.call_id = c.id WHERE h.user_id = ?",
		targetUserId,
	).Rows()
	if err != nil {
		log.Printf("history query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query history"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id uint
		var callerId uint
		var startTime time.Time
		var endTime *time.Time
		if err := rows.Scan(&id, &callerId, &startTime, &endTime); err != nil {
			log.Printf("row scan error: %v", err)
			continue
		}
		call := models.Call{
			Id:        id,
			CallerId:  callerId,
			StartTime: startTime,
			EndTime:   endTime,
		}
		// fill callee ids from history table if needed
		var hs []models.History
		if err := db.Where("call_id = ?", id).Find(&hs).Error; err == nil {
			for _, hh := range hs {
				if hh.Role == "callee" {
					call.CalleeIds = append(call.CalleeIds, hh.UserId)
				}
			}
		}
		history = append(history, call)
	}

	c.JSON(http.StatusOK, history)
}
