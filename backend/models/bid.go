package models

import "time"

type Bid struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	AuctionID   uint      `gorm:"not null;index;uniqueIndex:idx_bid_idempotency" json:"auction_id"`
	UserID      uint      `gorm:"not null;index;uniqueIndex:idx_bid_idempotency" json:"user_id"`
	Amount      float64   `gorm:"type:decimal(12,2);not null" json:"amount"`
	AmountCents int64     `gorm:"not null;default:0" json:"amount_cents"`
	ClientBidID *string   `gorm:"size:64;uniqueIndex:idx_bid_idempotency" json:"client_bid_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}
