package database

import (
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/Neb-iyu/facetime-app/backend/models"
)

var Db *gorm.DB

//Initialize Sqlite Database
func InitSqliteDB() {
	var err error
	Db, err = gorm.Open(sqlite.Open("facetime.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	Db.AutoMigrate(&models.User{})
	Db.AutoMigrate(&models.Call{})
	Db.AutoMigrate(&models.UserContact{})

}
