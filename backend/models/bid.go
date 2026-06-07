package models

import "time"

type Bid struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	AuctionID uint      `gorm:"not null;index" json:"auction_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Amount    float64   `gorm:"type:decimal(12,2);not null" json:"amount"`
	CreatedAt time.Time `json:"created_at"`
}
