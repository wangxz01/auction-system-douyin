package models

import (
	"time"

	"gorm.io/gorm"
)

type Order struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	AuctionID  uint      `gorm:"not null;uniqueIndex" json:"auction_id"`
	UserID     uint      `gorm:"not null;index" json:"user_id"`
	FinalPrice float64   `gorm:"type:decimal(12,2);not null" json:"final_price"`
	Status     string    `gorm:"size:16;not null" json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// CreateOrderForAuction 在订单表插入一条记录。
// auction_id 上有唯一索引，重复调用会失败（用于避免封顶价 + 定时器同时落单）。
func CreateOrderForAuction(db *gorm.DB, auctionID, userID uint, finalPrice float64) error {
	o := Order{
		AuctionID:  auctionID,
		UserID:     userID,
		FinalPrice: finalPrice,
		Status:     "pending",
	}
	return db.Create(&o).Error
}
