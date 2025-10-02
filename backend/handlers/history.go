package handlers

import (
	"net/http"
	"strconv"

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

