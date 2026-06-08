package models

import "time"

// UserEvent 记录用户在直播间的行为埋点，
// 用于后续的数据治理 / 行为分析（进房、点击、停留等）。
type UserEvent struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	AuctionID uint      `gorm:"not null;index" json:"auction_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	EventType string    `gorm:"size:64;not null;index" json:"event_type"`
	Metadata  string    `gorm:"type:text" json:"metadata"`
	UserAgent string    `gorm:"size:255" json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
}
