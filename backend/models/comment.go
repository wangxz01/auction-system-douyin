package models

import "time"

type Comment struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	AuctionID uint      `gorm:"not null;index:idx_comments_auction_created" json:"auction_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Username  string    `gorm:"size:64;not null" json:"username"`
	Content   string    `gorm:"size:300;not null" json:"content"`
	CreatedAt time.Time `gorm:"index:idx_comments_auction_created" json:"created_at"`
}
