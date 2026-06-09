package config

import (
	"fmt"
	"log"
	"time"

	"auction-system/backend/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedDemoData 在首次启动时灌入演示用账户 / 商家 / 拍卖 / 出价 / 订单。
//
// 由 SEED_DEMO_DATA 环境变量控制；默认关闭。
// 通过用户名前缀 demo- 做幂等检测，已存在则全部跳过。
// 详细资产清单见 docs/演示数据.md。
//
// 生产环境必须保持 SEED_DEMO_DATA 关闭（弱密码 demo1234）。
func SeedDemoData(db *gorm.DB) {
	if !Get().SeedDemoData {
		return
	}
	if db == nil {
		log.Println("[seed] DB is nil, skipping")
		return
	}
	var existing int64
	if err := db.Model(&models.User{}).Where("username LIKE ?", "demo-%").Count(&existing).Error; err == nil && existing > 0 {
		log.Println("[seed] demo data already present, skipping")
		return
	}
	log.Println("[seed] populating demo data...")
	if err := db.Transaction(func(tx *gorm.DB) error {
		return seedDemoDataTx(tx)
	}); err != nil {
		log.Printf("[seed] failed: %v", err)
		return
	}
	log.Println("[seed] OK: 2 merchants / 12 buyers / 8 auctions")
}

func seedDemoDataTx(db *gorm.DB) error {
	pwHash, err := bcrypt.GenerateFromPassword([]byte("demo1234"), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("bcrypt: %w", err)
	}

	// ---- 商家 + 买家 ----
	merchant1 := models.User{Username: "demo-merchant-1", PasswordHash: string(pwHash)}
	merchant2 := models.User{Username: "demo-merchant-2", PasswordHash: string(pwHash)}
	if err := db.Create(&merchant1).Error; err != nil {
		return fmt.Errorf("merchant1: %w", err)
	}
	if err := db.Create(&merchant2).Error; err != nil {
		return fmt.Errorf("merchant2: %w", err)
	}
	if err := db.Create(&models.Merchant{UserID: merchant1.ID, DisplayName: "东方艺术廊", Status: "active"}).Error; err != nil {
		return fmt.Errorf("merchant profile1: %w", err)
	}
	if err := db.Create(&models.Merchant{UserID: merchant2.ID, DisplayName: "珍藏阁", Status: "active"}).Error; err != nil {
		return fmt.Errorf("merchant profile2: %w", err)
	}

	buyers := make([]models.User, 12)
	for i := 0; i < 12; i++ {
		u := models.User{
			Username:     fmt.Sprintf("demo-buyer-%d", i+1),
			PasswordHash: string(pwHash),
		}
		if err := db.Create(&u).Error; err != nil {
			return fmt.Errorf("buyer%d: %w", i+1, err)
		}
		buyers[i] = u
	}

	// ---- 拍卖规格 ----
	// 所有 active 拍卖 ends_at 都设到 NOW+14d 以上，确保演示窗口 > 10 天。
	type spec struct {
		title           string
		desc            string
		imageURL        string
		seller          models.User
		startCents      int64
		stepCents       int64
		ceilingCents    *int64
		bidsCount       int // 已有出价条数（current = start + bidsCount * step）
		status          string
		endsInDays      int
		durationSeconds int
		bidSpreadDays   int // 出价时间分散到过去多少天
	}
	ceiling2 := int64(200000)  // 2000
	ceiling3 := int64(3000000) // 30000
	ceiling5 := int64(150000)  // 1500
	ceiling7 := int64(150000)  // 1500（finished 用，已被命中）

	specs := []spec{
		{
			title: "清代青花瓷瓶", desc: "清代景德镇出品，胎体匀薄，纹饰清雅。",
			imageURL: "https://picsum.photos/seed/lot1qing/800/600",
			seller:   merchant1, startCents: 100000, stepCents: 10000, ceilingCents: nil,
			bidsCount: 35, status: "active", endsInDays: 22,
			durationSeconds: 30 * 86400, bidSpreadDays: 7,
		},
		{
			title: "民国老照片相册", desc: "民国 30 年代家庭照片合集，约 60 张原版银盐照片。",
			imageURL: "https://picsum.photos/seed/lot2photos/800/600",
			seller:   merchant1, startCents: 20000, stepCents: 5000, ceilingCents: &ceiling2,
			bidsCount: 13, status: "active", endsInDays: 14,
			durationSeconds: 21 * 86400, bidSpreadDays: 5,
		},
		{
			title: "元代龙泉窑碗", desc: "元代龙泉窑青釉碗，碗心刻花，圈足露胎。",
			imageURL: "https://picsum.photos/seed/lot3longquan/800/600",
			seller:   merchant2, startCents: 500000, stepCents: 50000, ceilingCents: &ceiling3,
			bidsCount: 22, status: "active", endsInDays: 28,
			durationSeconds: 30 * 86400, bidSpreadDays: 6,
		},
		{
			title: "明代竹雕笔筒", desc: "明代浮雕「松鹤延年」笔筒，包浆温润。",
			imageURL: "https://picsum.photos/seed/lot4zhumu/800/600",
			seller:   merchant2, startCents: 80000, stepCents: 10000, ceilingCents: nil,
			bidsCount: 24, status: "active", endsInDays: 18,
			durationSeconds: 25 * 86400, bidSpreadDays: 5,
		},
		{
			title: "民国景德镇茶具六件套", desc: "民国景德镇粉彩茶具六件套，含壶一茶杯五。",
			imageURL: "https://picsum.photos/seed/lot5tea/800/600",
			seller:   merchant1, startCents: 30000, stepCents: 5000, ceilingCents: &ceiling5,
			bidsCount: 9, status: "active", endsInDays: 25,
			durationSeconds: 30 * 86400, bidSpreadDays: 4,
		},
		{
			title: "当代名家国画《山居图》", desc: "当代名家纸本水墨，立轴，落款钤印齐全。即将开拍。",
			imageURL: "https://picsum.photos/seed/lot6painting/800/600",
			seller:   merchant2, startCents: 200000, stepCents: 20000, ceilingCents: nil,
			bidsCount: 0, status: "pending", endsInDays: 0,
			durationSeconds: 20 * 86400, bidSpreadDays: 0,
		},
		{
			title: "民国象牙麻将一副", desc: "民国象牙骨牌麻将整副 144 张，原木盒。已成交。",
			imageURL: "https://picsum.photos/seed/lot7mahjong/800/600",
			seller:   merchant1, startCents: 50000, stepCents: 10000, ceilingCents: &ceiling7,
			bidsCount: 10, status: "finished", endsInDays: -1, // ends 在过去
			durationSeconds: 7 * 86400, bidSpreadDays: 6,
		},
		{
			title: "仿古铜镜（已取消）", desc: "仿宋海兽葡萄纹铜镜，因鉴定争议取消。",
			imageURL: "https://picsum.photos/seed/lot8mirror/800/600",
			seller:   merchant2, startCents: 10000, stepCents: 5000, ceilingCents: nil,
			bidsCount: 0, status: "cancelled", endsInDays: 0,
			durationSeconds: 7 * 86400, bidSpreadDays: 0,
		},
	}

	now := time.Now()
	for i, s := range specs {
		current := s.startCents + int64(s.bidsCount)*s.stepCents
		a := models.Auction{
			SellerUserID:      s.seller.ID,
			Title:             s.title,
			Description:       s.desc,
			ImageURL:          s.imageURL,
			StartPrice:        centsToYuan(s.startCents),
			StartPriceCents:   s.startCents,
			PriceStep:         centsToYuan(s.stepCents),
			PriceStepCents:    s.stepCents,
			CurrentPrice:      centsToYuan(current),
			CurrentPriceCents: current,
			DurationSeconds:   s.durationSeconds,
			AutoExtendSeconds: 30,
			Status:            s.status,
		}
		if s.ceilingCents != nil {
			cy := centsToYuan(*s.ceilingCents)
			a.CeilingPrice = &cy
			a.CeilingPriceCents = s.ceilingCents
		}
		if s.status == "active" || s.status == "finished" {
			started := now.AddDate(0, 0, -s.bidSpreadDays-1)
			a.StartedAt = &started
		}
		if s.status == "active" || s.status == "finished" {
			ends := now.AddDate(0, 0, s.endsInDays)
			a.EndsAt = &ends
		}
		if err := db.Create(&a).Error; err != nil {
			return fmt.Errorf("auction[%d]: %w", i, err)
		}

		// 灌出价历史：第 k 个出价 amount = start + (k+1)*step，由 buyers 轮转
		var lastBidder models.User
		for k := 0; k < s.bidsCount; k++ {
			bidder := buyers[(i*7+k)%len(buyers)] // 让不同拍卖的出价人有差异
			amountCents := s.startCents + int64(k+1)*s.stepCents
			// 时间在 [now-bidSpreadDays, now-1h] 间均匀分布
			tsOffset := time.Duration(s.bidSpreadDays) * 24 * time.Hour * time.Duration(s.bidsCount-k) / time.Duration(s.bidsCount+1)
			ts := now.Add(-tsOffset - time.Hour)
			bid := models.Bid{
				AuctionID:   a.ID,
				UserID:      bidder.ID,
				Amount:      centsToYuan(amountCents),
				AmountCents: amountCents,
				CreatedAt:   ts,
			}
			if err := db.Create(&bid).Error; err != nil {
				return fmt.Errorf("bid[%d/%d]: %w", i, k, err)
			}
			lastBidder = bidder
		}
		if s.bidsCount > 0 && lastBidder.ID != 0 {
			winnerID := lastBidder.ID
			db.Model(&a).Updates(map[string]any{"winner_id": winnerID})
			a.WinnerID = &winnerID
		}

		if err := seedAuctionCommentsAndEvents(db, a, buyers, i, now); err != nil {
			return err
		}

		// finished 拍卖：补一条订单
		if s.status == "finished" && a.WinnerID != nil {
			if err := models.CreateOrderForAuctionCents(db, a.ID, *a.WinnerID, current); err != nil {
				return fmt.Errorf("order[%d]: %w", i, err)
			}
		}
	}

	return nil
}

func seedAuctionCommentsAndEvents(db *gorm.DB, a models.Auction, buyers []models.User, auctionIndex int, now time.Time) error {
	if a.Status != "active" {
		return nil
	}
	commentTexts := []string{
		"这个品相不错，想看一下细节",
		"价格还在预算内，继续观望",
		"主播能不能再展示一下底部款识",
	}
	for j, text := range commentTexts {
		user := buyers[(auctionIndex*3+j)%len(buyers)]
		comment := models.Comment{
			AuctionID: a.ID,
			UserID:    user.ID,
			Username:  user.Username,
			Content:   text,
			CreatedAt: now.Add(-time.Duration(30-j*7) * time.Minute),
		}
		if err := db.Create(&comment).Error; err != nil {
			return fmt.Errorf("comment[%d/%d]: %w", auctionIndex, j, err)
		}
	}
	for j := 0; j < len(buyers); j++ {
		event := models.UserEvent{
			AuctionID: a.ID,
			UserID:    buyers[j].ID,
			EventType: "enter_room",
			Metadata:  fmt.Sprintf(`{"seed":true,"lot_index":%d}`, auctionIndex+1),
			UserAgent: "demo-seed",
			CreatedAt: now.Add(-time.Duration(j+1) * time.Minute),
		}
		if err := db.Create(&event).Error; err != nil {
			return fmt.Errorf("event[%d/%d]: %w", auctionIndex, j, err)
		}
	}
	return nil
}

func centsToYuan(c int64) float64 {
	return float64(c) / 100.0
}
