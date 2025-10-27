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

func GetUserHistory(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		log.Printf("Failed to bind id JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := database.Db
	var history []models.Call
	
	rows, err := db.Raw(
		"SELECT c.id, c.callerId, c.StartTime, h.EndTime FROM calls c JOIN history h on h.callid = c.id WHERE h.userid = ?",
		userId,
	).Rows()
	defer rows.Close()
	for rows.Next() {
		var id uint
		var callerId uint
		var startTime time.Time
		var endTime *time.Time
		if err := rows.Scan(&id, &callerId, &startTime, endTime); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			log.Printf("Failed to find user %v's history: %v", userId, err.Error())
			return
		}
		call := models.Call{
			Id: id,
			CallerId: callerId,
			StartTime: startTime,
			EndTime: endTime,
		}
		var h []models.History
		if err := db.Where("callid = ?", id).Find(&h).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			log.Printf("Failed to find call %v's history: %v", call.Id, err.Error())
		}
		for _, c := range(h) {
			if c.Role == "callee" {
				call.CalleeIds = append(call.CalleeIds, c.UserId)
			}
		}
		history = append(history, call)
	}
}
