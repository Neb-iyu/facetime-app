package main

import (
	// 	"fmt"
	"log"
	// 	"net/http"
	// 	"strconv"
	// 	"time"

	"github.com/Neb-iyu/facetime-app/backend/database"
	//"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/Neb-iyu/facetime-app/backend/ws"
	"github.com/Neb-iyu/facetime-app/backend/handlers"
	"github.com/gin-gonic/gin"
)

func main() {
	database.InitSqliteDB()
	wsHub := ws.NewHub()
	r := setupRouter(wsHub)
	if err := r.Run(); err != nil {
		log.Fatal("Failed to run server:", err)
	}
}

func setupRouter(hub *ws.Hub) *gin.Engine {
	router := gin.Default()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	apiRoutes := router.Group("/api")
	{
		users := apiRoutes.Group("/users")
		{
			users.GET("", )
			users.GET("/:id", )
			users.POST("", )
			users.PUT("/:id", )
			users.GET("/:id/contacts", )
			users.GET("/:id/history")
		}
		calls := apiRoutes.Group("/history")
		{
			calls.GET("/:id", )
			calls.POST("", )
		}
		apiRoutes.POST("contacts", )

		apiRoutes.GET("ws", handlers.WebSocketHandler(hub))
	}


	
	return router
}