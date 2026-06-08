package models

import "time"

type Auction struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	SellerUserID      uint       `gorm:"index" json:"seller_user_id"`
	Title             string     `gorm:"size:255;not null" json:"title"`
	Description       string     `gorm:"type:text" json:"description"`
	ImageURL          string     `gorm:"size:512" json:"image_url"`
	StreamURL         string     `gorm:"size:500" json:"stream_url"`
	StartPrice        float64    `gorm:"type:decimal(12,2);not null" json:"start_price"`
	StartPriceCents   int64      `gorm:"not null;default:0" json:"start_price_cents"`
	PriceStep         float64    `gorm:"type:decimal(12,2);not null" json:"price_step"`
	PriceStepCents    int64      `gorm:"not null;default:0" json:"price_step_cents"`
	CeilingPrice      *float64   `gorm:"type:decimal(12,2)" json:"ceiling_price"`
	CeilingPriceCents *int64     `json:"ceiling_price_cents"`
	CurrentPrice      float64    `gorm:"type:decimal(12,2);not null" json:"current_price"`
	CurrentPriceCents int64      `gorm:"not null;default:0" json:"current_price_cents"`
	DurationSeconds   int        `gorm:"not null" json:"duration_seconds"`
	Status            string     `gorm:"size:16;not null;index" json:"status"`
	WinnerID          *uint      `json:"winner_id"`
	StartedAt         *time.Time `json:"started_at"`
	EndsAt            *time.Time `gorm:"index" json:"ends_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}
