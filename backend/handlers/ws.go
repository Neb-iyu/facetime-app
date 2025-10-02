package handlers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/Neb-iyu/facetime-app/backend/ws"
	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/utils"
	
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func WebSocketHandler(hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := strconv.ParseUint(c.Query("user_id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
			return
		}

		db := database.Db
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return 
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("Websocket upgrade failed: %v", err)
			return
		}

		sessionID, _ := utils.GenerateToken()

		client := &ws.Client{
			Hub: hub,
			Conn: conn,
			Send: make(chan models.WebSocketMessage, 256),
			UserID: uint(userID),
			Username: user.Name,
			SessionID: sessionID,
			IsAuthenticated: true,
		}

		hub.Register <- client

		go client.WritePump()
		go client.ReadPump()
	}
}
