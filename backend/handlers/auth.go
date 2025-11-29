package handlers

import (
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Neb-iyu/facetime-app/backend/database"
	"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/Neb-iyu/facetime-app/backend/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// AuthMiddleware validates Bearer JWT and sets "authUser" in context.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if h == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization"})
			return
		}
		parts := strings.SplitN(h, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
			return
		}
		token := parts[1]

		claims, err := utils.ValidateToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		// claims.Username is expected to be the user ID as string (set at login)
		uid, err := strconv.Atoi(claims.Username)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token subject"})
			return
		}

		var user models.User
		if err := database.Db.First(&user, uint(uid)).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			return
		}
		c.Set("authUser", user)
		c.Next()
	}
}

// add binding requirements
type loginPayload struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var p loginPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var user models.User
	if err := database.Db.Where("email = ?", p.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// bcrypt compare
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(p.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// create JWT with Username set to user ID string
	token, err := utils.GenerateTokenFor(strconv.Itoa(int(user.Id)))
	if err != nil {
		log.Printf("token generation error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// don't leak password
	user.Password = ""

	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

// registerPayload is used for JSON fallback (when client doesn't send multipart)
type registerPayload struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func Register(c *gin.Context) {
	// Support both multipart/form-data (with file) and JSON body.
	contentType := c.GetHeader("Content-Type")
	var user models.User

	if strings.HasPrefix(contentType, "multipart/form-data") {
		// Parse multipart form (max 10MB file)
		if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid multipart form"})
			return
		}
		name := c.Request.FormValue("name")
		email := c.Request.FormValue("email")
		password := c.Request.FormValue("password")

		if password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "password required"})
			return
		}

		// hash password
		hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("password hash error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process password"})
			return
		}

		user = models.User{
			Name:     name,
			Email:    email,
			Password: string(hashed),
		}
		if err = database.Db.Create(&user).Error; err != nil {
			log.Printf("create user error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}

		// handle avatar file if present
		file, header, ferr := c.Request.FormFile("avatar")
		if ferr == nil && file != nil {
			defer file.Close()
			uploadsDir := filepath.Join("uploads", "avatars")
			if err := os.MkdirAll(uploadsDir, 0755); err == nil {
				ext := filepath.Ext(header.Filename)
				filename := strconv.Itoa(int(user.Id)) + "_" + strconv.FormatInt(time.Now().Unix(), 10) + ext
				outPath := filepath.Join(uploadsDir, filename)
				outFile, err := os.Create(outPath)
				if err == nil {
					defer outFile.Close()
					_, _ = io.Copy(outFile, file)
					avatarUrl := "/uploads/avatars/" + filename
					user.AvatarUrl = &avatarUrl
					_ = database.Db.Save(&user).Error
				}
			}
		}
	} else {
		// JSON path
		var p registerPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// hash password
		hashed, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("password hash error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process password"})
			return
		}

		user = models.User{
			Name:     p.Name,
			Email:    p.Email,
			Password: string(hashed),
		}
		if err := database.Db.Create(&user).Error; err != nil {
			log.Printf("create user error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}
	}

	token, terr := utils.GenerateTokenFor(strconv.Itoa(int(user.Id)))
	if terr != nil {
		log.Printf("Register: Error generating token for user %v: %v", user.Id, terr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// don't leak password
	user.Password = ""

	c.JSON(http.StatusCreated, gin.H{"user": user, "token": token})
}

func Me(c *gin.Context) {
	u, ok := c.Get("authUser")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}
	// ensure password not leaked if authUser is a models.User
	if usr, ok := u.(models.User); ok {
		usr.Password = ""
		c.JSON(http.StatusOK, usr)
		return
	}
	c.JSON(http.StatusOK, u)
}

func Logout(c *gin.Context) {
	// stateless JWT: client should discard token; server can implement revocation if needed
	c.Status(http.StatusNoContent)
}
