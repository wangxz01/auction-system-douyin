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
		&models.Comment{},
		&models.Merchant{},
		&models.UserEvent{},
	); err != nil {
		log.Fatalf("❌ AutoMigrate 失败: %v", err)
	}

	backfillMoneyColumns(db)

	DB = db
	log.Println("✅ MySQL 连接成功 + 表结构已同步")
}

func backfillMoneyColumns(db *gorm.DB) {
	db.Model(&models.Auction{}).
		Where("start_price_cents = 0 AND start_price > 0").
		Update("start_price_cents", gorm.Expr("ROUND(start_price * 100)"))
	db.Model(&models.Auction{}).
		Where("price_step_cents = 0 AND price_step > 0").
		Update("price_step_cents", gorm.Expr("ROUND(price_step * 100)"))
	db.Model(&models.Auction{}).
		Where("current_price_cents = 0 AND current_price > 0").
		Update("current_price_cents", gorm.Expr("ROUND(current_price * 100)"))
	db.Model(&models.Auction{}).
		Where("ceiling_price_cents IS NULL AND ceiling_price IS NOT NULL").
		Update("ceiling_price_cents", gorm.Expr("ROUND(ceiling_price * 100)"))
	db.Model(&models.Bid{}).
		Where("amount_cents = 0 AND amount > 0").
		Update("amount_cents", gorm.Expr("ROUND(amount * 100)"))
	db.Model(&models.Order{}).
		Where("final_price_cents = 0 AND final_price > 0").
		Update("final_price_cents", gorm.Expr("ROUND(final_price * 100)"))
}
