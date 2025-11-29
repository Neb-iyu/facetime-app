package handlers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/Neb-iyu/facetime-app/backend/ws"
	"github.com/gin-gonic/gin"
)

var wsHub *ws.Hub

func SetupWSHub(hub *ws.Hub) {
	wsHub = hub
}

func GetUsers(c *gin.Context) {
	db := database.Db
	var users []models.User
	if result := db.Find(&users); result.Error != nil {
		log.Printf("Failed to get users from db: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

func GetUser(c *gin.Context) {
	idParam := c.Param("id")
	if idParam == "me" {
		ai, ok := c.Get("authUser")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
			return
		}
		authUser := ai.(models.User)
		c.JSON(http.StatusOK, authUser)
		return
	}

	id, err := strconv.Atoi(idParam)
	if err != nil {
		log.Printf("Failed to bind id JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var user models.User
	db := database.Db

	if result := db.First(&user, id); result.Error != nil {
		log.Printf("Failed to get users from db: %v", result.Error)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func AddUser(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		log.Printf("Failed to bind user JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := database.Db
	if result := db.Create(&user); result.Error != nil {
		log.Printf("Failed to create user: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	log.Printf("User created: %v", user.Id)
	c.JSON(http.StatusCreated, user)
}

// UpdateUser updates any user (admin) - keep existing behavior
func UpdateUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		log.Printf("Failed to bind id JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var user models.User
	db := database.Db

	if result := db.First(&user, id); result.Error != nil {
		log.Printf("Failed to get users from db: %v", result.Error)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var updateData models.User
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if updateData.Name != "" {
		user.Name = updateData.Name
	}
	if updateData.Email != "" {
		user.Email = updateData.Email
	}
	if updateData.AvatarUrl != nil && *updateData.AvatarUrl != "" {
		user.AvatarUrl = updateData.AvatarUrl
	}
	if res := db.Save(&user); res.Error != nil {
		log.Printf("Failed to update user %v: %v", user.Id, res.Error)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, user)
}

// UpdateMeProfile updates the authenticated user's profile
func UpdateMeProfile(c *gin.Context) {
	ai, ok := c.Get("authUser")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}
	authUser := ai.(models.User)

	var updateData models.User
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if updateData.Name != "" {
		authUser.Name = updateData.Name
	}
	if updateData.Email != "" {
		authUser.Email = updateData.Email
	}
	if updateData.AvatarUrl != nil && *updateData.AvatarUrl != "" {
		authUser.AvatarUrl = updateData.AvatarUrl
	}
	database.Db.Save(&authUser)
	c.JSON(http.StatusOK, authUser)
}

func GetContacts(c *gin.Context) {
	// support /users/:id/contacts with :id == "me"
	idParam := c.Param("id")
	var uid uint64
	if idParam == "me" {
		ai, ok := c.Get("authUser")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
			return
		}
		authUser := ai.(models.User)
		uid = uint64(authUser.Id)
	} else {
		parsed, err := strconv.ParseUint(idParam, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}
		uid = parsed
	}

	db := database.Db
	var contacts []models.User
	if result := db.Where("user_id = ?", uid).Find(&contacts); result.Error != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, contacts)
}

func AddContact(c *gin.Context) {
	var contact models.UserContact
	if err := c.ShouldBindJSON(&contact); err != nil {
		log.Printf("Failed to bind user contact JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ensure owner is authenticated user if not provided
	if contact.UserId == 0 {
		if ai, ok := c.Get("authUser"); ok {
			authUser := ai.(models.User)
			contact.UserId = authUser.Id
		}
	}

	db := database.Db
	if result := db.Create(&contact); result.Error != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, contact)
}

//GetUserHistory takes the user's id and returns its call history in JSON format

//ws functions

// GetOnlineUsers serializes the online users in JSON format and sends them to client
func GetOnlineUsers(c *gin.Context) {
	/*userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		log.Printf("Failed to bind id JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}*/

	onlineUsers := wsHub.GetOnlineUsers()
	c.JSON(http.StatusOK, gin.H{"online_users": onlineUsers})
}

// CheckUserStatus takes a single user's id, check for its status, serializes the result in JSON format, and sends it to the requesting client
func CheckUserStatus(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("user_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	status := wsHub.CheckUserStatus(uint(userID))
	c.JSON(http.StatusOK, gin.H{"status": status})
}
