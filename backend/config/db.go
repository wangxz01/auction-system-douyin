package config

import (
	"fmt"
	"log"

	"auction-system/backend/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// DB 是全局 GORM 数据库句柄，业务代码通过 config.DB 访问数据库。
var DB *gorm.DB

// InitDB 用 .env 里的配置连 MySQL，并自动建表。
func InitDB(cfg *Config) {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("❌ MySQL 连接失败: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Auction{},
		&models.Bid{},
		&models.Order{},
	); err != nil {
		log.Fatalf("❌ AutoMigrate 失败: %v", err)
	}

	DB = db
	log.Println("✅ MySQL 连接成功 + 表结构已同步")
}
