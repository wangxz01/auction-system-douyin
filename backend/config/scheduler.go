package config

import (
	"log"
	"time"

	"auction-system/backend/models"
	"auction-system/backend/ws"
)

// StartScheduler 启动一个后台 goroutine，每 5 秒扫描一次过期的 active 竞拍。
// 命中的竞拍状态改为 finished，并为有 winner 的竞拍生成订单。
func StartScheduler() {
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			sweepExpired()
		}
	}()
	log.Println("✅ 定时器已启动（每 5 秒扫描过期竞拍）")
}

func sweepExpired() {
	var auctions []models.Auction
	if err := DB.
		Where("status = ? AND ends_at IS NOT NULL AND ends_at <= ?", "active", time.Now()).
		Find(&auctions).Error; err != nil {
		log.Printf("scheduler 查询失败: %v", err)
		return
	}

	for _, a := range auctions {
		// 用条件更新保证幂等：如果竞拍已被其它路径（封顶价命中）改成 finished，这里不会再次触发。
		res := DB.Model(&models.Auction{}).
			Where("id = ? AND status = ?", a.ID, "active").
			Update("status", "finished")
		if res.Error != nil {
			log.Printf("scheduler 更新竞拍 %d 失败: %v", a.ID, res.Error)
			continue
		}
		if res.RowsAffected == 0 {
			continue
		}

		// 重新查最新数据用于广播（CurrentPrice 可能在快照后被更新）
		var fresh models.Auction
		if err := DB.First(&fresh, a.ID).Error; err != nil {
			fresh = a
		}

		if fresh.WinnerID != nil {
			finalPriceCents := fresh.CurrentPriceCents
			if finalPriceCents == 0 && fresh.CurrentPrice > 0 {
				finalPriceCents = int64(fresh.CurrentPrice*100 + 0.5)
			}
			if err := models.CreateOrderForAuctionCents(DB, fresh.ID, *fresh.WinnerID, finalPriceCents); err != nil {
				log.Printf("scheduler 生成订单失败 auction=%d: %v", fresh.ID, err)
			} else {
				log.Printf("⏰ 竞拍 %d 到期结束，生成订单成功", fresh.ID)
			}
		} else {
			log.Printf("⏰ 竞拍 %d 到期结束，无人出价不生成订单", fresh.ID)
		}

		ws.H.Broadcast(fresh.ID, map[string]any{
			"type":              "auction_finished",
			"auction_id":        fresh.ID,
			"final_price":       fresh.CurrentPrice,
			"final_price_cents": fresh.CurrentPriceCents,
			"winner_id":         fresh.WinnerID,
		})
	}
}
