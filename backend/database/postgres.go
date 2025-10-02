package database

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"github.com/Neb-iyu/facetime-app/backend/models"
)

type PostgresConfig struct {
	Host string
	Port int
	User string
	Password string
	DBName string
	SSLMode string
}
var pgConfig *PostgresConfig

func LoadConfig() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: No .env file found, using sys environment variables")
	}

	dbPort, err := strconv.Atoi(getEnv("DB_PORT", "5432"))
	if err != nil {
		log.Fatal("Invalid DB_PORT value")
	}

	pgConfig = &PostgresConfig{
		Host: getEnv("DB_HOST", "localhost"),
		Port: dbPort, 
		User: getEnv("DB_USER", "user"),
		Password: getEnv("DB_PASSWORD", "1234"),
		DBName: getEnv("DB_NAME", "facetimedb"),
		SSLMode: getEnv("DB_SSLMODE", "disable"),
	}
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func (c *PostgresConfig) GetDBConnectionString() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode)
}

func InitPostgresDB() {
	LoadConfig()
	dsn := pgConfig.GetDBConnectionString()

	var err error
	Db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	Db.AutoMigrate(&models.User{})
	Db.AutoMigrate(&models.Call{})

}