package main

import (
	"log"

	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/handlers"
	"github.com/Neb-iyu/facetime-app/backend/ws"
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
	router.Static("/uploads", "./uploads")

	// public auth
	router.POST("/auth/login", handlers.Login)
	router.POST("/auth/register", handlers.Register)

	// protected
	auth := router.Group("/")
	auth.Use(handlers.AuthMiddleware())
	{
		auth.GET("/auth/me", handlers.Me)
		auth.POST("/auth/logout", handlers.Logout)

		// users
		users := auth.Group("/users")
		{
			users.GET("", handlers.GetUsers)           // GET /users
			users.GET("/:id", handlers.GetUser)        // GET /users/:id
			users.POST("", handlers.AddUser)           // POST /users
			users.PUT("/:id", handlers.UpdateUser)     // PUT /users/:id (admin or self)
			users.PUT("/me", handlers.UpdateMeProfile) // PUT /users/me (authenticated user)
			users.GET("/:id/contacts", handlers.GetContacts)
			users.GET("/:id/history", handlers.GetUserHistory)
			//users.POST("/:id/avatar", handlers.UploadAvatar) // optional upload endpoint
		}

		// history
		history := auth.Group("/history")
		{
			history.GET("/:id", handlers.GetHistory)
			history.POST("", handlers.AddHistory)
		}

		// contacts
		auth.POST("/contacts", handlers.AddContact)

		// calls
		calls := auth.Group("/calls")
		{
			calls.POST("", handlers.CreateCall)
			calls.GET("/:id", handlers.GetCall)
			calls.POST("/:id/join", handlers.JoinCall)
			calls.POST("/:id/accept", handlers.AcceptCall)
			calls.POST("/:id/leave", handlers.LeaveCall)
			calls.POST("/:id/end", handlers.EndCall)
			calls.GET("/:id/participants", handlers.GetCallParticipants)

			// media control
			calls.POST("/:id/publish", handlers.PublishTrack)
			calls.POST("/:id/renegotiate", handlers.Renegotiate)
		}

		// websocket upgrade - token validated during upgrade
		auth.GET("/ws", handlers.WebSocketHandler(hub))
	}

	// make wsHub available to handlers
	handlers.SetupWSHub(hub)

	return router
}
