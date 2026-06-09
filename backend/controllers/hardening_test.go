package controllers_test

import (
	"bytes"
	"encoding/json"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
)

func createNamedUser(t *testing.T, username string) models.User {
	t.Helper()
	u := models.User{Username: username, PasswordHash: "test"}
	if err := config.DB.Where("username = ?", username).Delete(&models.User{}).Error; err != nil {
		t.Fatalf("cleanup user: %v", err)
	}
	if err := config.DB.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() {
		config.DB.Where("user_id = ?", u.ID).Delete(&models.Merchant{})
		config.DB.Delete(&models.User{}, u.ID)
	})
	return u
}

func createActiveMerchant(t *testing.T, u models.User) {
	t.Helper()
	m := models.Merchant{UserID: u.ID, DisplayName: u.Username, Status: "active"}
	if err := config.DB.Create(&m).Error; err != nil {
		t.Fatalf("create merchant: %v", err)
	}
}

func authReq(t *testing.T, method, path string, body string, user models.User) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(t, user))
	return req
}

func TestAdminCanCreateAndDisableMerchant(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "root-admin")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "root-admin")
	seller := createNamedUser(t, "seller-managed")

	req := authReq(t, http.MethodPost, "/api/admin/merchants", `{"user_id":`+uintString(seller.ID)+`,"display_name":"Seller"}`, admin)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("create merchant status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var merchant models.Merchant
	if err := config.DB.Where("user_id = ?", seller.ID).First(&merchant).Error; err != nil {
		t.Fatalf("merchant not stored: %v", err)
	}
	if merchant.Status != "active" {
		t.Fatalf("merchant status = %q", merchant.Status)
	}

	req = authReq(t, http.MethodDelete, "/api/admin/merchants/"+uintString(seller.ID), "", admin)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("disable merchant status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if err := config.DB.Where("user_id = ?", seller.ID).First(&merchant).Error; err != nil {
		t.Fatalf("merchant missing after disable: %v", err)
	}
	if merchant.Status != "disabled" {
		t.Fatalf("merchant status after disable = %q", merchant.Status)
	}
}

func TestOnlyMerchantCanCreateAuctionWithCents(t *testing.T) {
	r := setupCommentTest(t)
	buyer := createNamedUser(t, "buyer-no-merchant")
	seller := createNamedUser(t, "seller-create")
	createActiveMerchant(t, seller)

	body := `{"title":"  Cents Auction  ","start_price_cents":10000,"price_step_cents":500,"ceiling_price_cents":15000,"duration_seconds":120}`
	req := authReq(t, http.MethodPost, "/api/auctions", body, buyer)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("non-merchant status = %d, body = %s", rec.Code, rec.Body.String())
	}

	req = authReq(t, http.MethodPost, "/api/auctions", body, seller)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("merchant create status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Data models.Auction `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	t.Cleanup(func() {
		config.DB.Delete(&models.Auction{}, resp.Data.ID)
	})
	if resp.Data.SellerUserID != seller.ID || resp.Data.StartPriceCents != 10000 || resp.Data.PriceStepCents != 500 {
		t.Fatalf("unexpected auction: %+v", resp.Data)
	}
	if resp.Data.Title != "Cents Auction" {
		t.Fatalf("title was not trimmed: %q", resp.Data.Title)
	}
}

func TestMerchantCanCreateZeroStartAuctionWithValidAutoExtend(t *testing.T) {
	r := setupCommentTest(t)
	seller := createNamedUser(t, "seller-zero-start")
	createActiveMerchant(t, seller)

	body := `{"title":"Zero Start","start_price_cents":0,"price_step_cents":100,"duration_seconds":120,"auto_extend_seconds":20}`
	req := authReq(t, http.MethodPost, "/api/auctions", body, seller)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("zero start status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Data models.Auction `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	t.Cleanup(func() { config.DB.Delete(&models.Auction{}, resp.Data.ID) })
	if resp.Data.StartPriceCents != 0 || resp.Data.CurrentPriceCents != 0 || resp.Data.AutoExtendSeconds != 20 {
		t.Fatalf("unexpected zero start auction: %+v", resp.Data)
	}

	req = authReq(t, http.MethodPost, "/api/auctions", `{"title":"Bad Extend","start_price_cents":0,"price_step_cents":100,"duration_seconds":120,"auto_extend_seconds":9}`, seller)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid auto extend status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestOrderRequiresOwnerSellerOrAdmin(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "order-admin")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "order-admin")
	seller := createNamedUser(t, "order-seller")
	buyer := createNamedUser(t, "order-buyer")
	other := createNamedUser(t, "order-other")
	createActiveMerchant(t, seller)
	a := createCommentTestAuction(t)
	a.SellerUserID = seller.ID
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("update auction seller: %v", err)
	}
	order := models.Order{AuctionID: a.ID, UserID: buyer.ID, FinalPrice: 123, FinalPriceCents: 12300, Status: "pending"}
	if err := config.DB.Create(&order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	t.Cleanup(func() { config.DB.Delete(&models.Order{}, order.ID) })

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/auctions/"+uintString(a.ID)+"/order", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status = %d", rec.Code)
	}

	req := authReq(t, http.MethodGet, "/api/auctions/"+uintString(a.ID)+"/order", "", other)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("other status = %d, body = %s", rec.Code, rec.Body.String())
	}

	for _, u := range []models.User{buyer, seller, admin} {
		req = authReq(t, http.MethodGet, "/api/auctions/"+uintString(a.ID)+"/order", "", u)
		rec = httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s status = %d, body = %s", u.Username, rec.Code, rec.Body.String())
		}
	}
}

func TestCommentsForMissingAuctionReturnNotFound(t *testing.T) {
	r := setupCommentTest(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auctions/99999999/comments", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestConcurrentBidsCannotOverwriteHigherBid(t *testing.T) {
	r := setupCommentTest(t)
	u1 := createNamedUser(t, "bidder-high")
	u2 := createNamedUser(t, "bidder-low")
	a := createCommentTestAuction(t)
	ends := time.Now().Add(time.Minute)
	a.CurrentPrice = 100
	a.StartPriceCents = 10000
	a.CurrentPriceCents = 10000
	a.PriceStepCents = 100
	a.Status = "active"
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("update auction: %v", err)
	}

	var wg sync.WaitGroup
	for _, tc := range []struct {
		user   models.User
		amount int64
	}{
		{u1, 12000},
		{u2, 10100},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", `{"amount_cents":`+strconv.FormatInt(tc.amount, 10)+`}`, tc.user)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK && rec.Code != http.StatusBadRequest {
				t.Errorf("unexpected bid status = %d, body = %s", rec.Code, rec.Body.String())
			}
		}()
	}
	wg.Wait()

	var fresh models.Auction
	if err := config.DB.First(&fresh, a.ID).Error; err != nil {
		t.Fatalf("load auction: %v", err)
	}
	if fresh.CurrentPriceCents != 12000 || fresh.WinnerID == nil || *fresh.WinnerID != u1.ID {
		t.Fatalf("higher bid was not preserved: %+v", fresh)
	}
}

func TestDuplicateClientBidIDCreatesOnlyOneBid(t *testing.T) {
	r := setupCommentTest(t)
	bidder := createNamedUser(t, "bidder-idempotent")
	a := createCommentTestAuction(t)
	ends := time.Now().Add(time.Minute)
	a.CurrentPrice = 0
	a.StartPrice = 0
	a.StartPriceCents = 0
	a.CurrentPriceCents = 0
	a.PriceStep = 1
	a.PriceStepCents = 100
	a.Status = "active"
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	body := `{"amount_cents":100,"client_bid_id":"same-click-1"}`
	for i := 0; i < 2; i++ {
		req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", body, bidder)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("attempt %d status = %d, body = %s", i+1, rec.Code, rec.Body.String())
		}
	}

	var count int64
	if err := config.DB.Model(&models.Bid{}).
		Where("auction_id = ? AND user_id = ?", a.ID, bidder.ID).
		Count(&count).Error; err != nil {
		t.Fatalf("count bids: %v", err)
	}
	if count != 1 {
		t.Fatalf("duplicate idempotency key created %d bids", count)
	}
}

func TestDuplicateClientBidIDAfterCeilingIsStillIdempotent(t *testing.T) {
	r := setupCommentTest(t)
	bidder := createNamedUser(t, "bidder-idempotent-ceiling")
	a := createCommentTestAuction(t)
	ends := time.Now().Add(time.Minute)
	a.CurrentPrice = 0
	a.StartPrice = 0
	a.StartPriceCents = 0
	a.CurrentPriceCents = 0
	a.PriceStep = 1
	a.PriceStepCents = 100
	ceiling := int64(100)
	a.CeilingPrice = floatPtr(1)
	a.CeilingPriceCents = &ceiling
	a.Status = "active"
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	body := `{"amount_cents":100,"client_bid_id":"same-ceiling-click"}`
	for i := 0; i < 2; i++ {
		req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", body, bidder)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("attempt %d status = %d, body = %s", i+1, rec.Code, rec.Body.String())
		}
	}
}

func TestRapidDifferentClientBidIDIsRateLimited(t *testing.T) {
	r := setupCommentTest(t)
	bidder := createNamedUser(t, "bidder-rate-limit")
	a := createCommentTestAuction(t)
	ends := time.Now().Add(time.Minute)
	a.CurrentPrice = 0
	a.StartPrice = 0
	a.StartPriceCents = 0
	a.CurrentPriceCents = 0
	a.PriceStep = 1
	a.PriceStepCents = 100
	a.Status = "active"
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", `{"amount_cents":100,"client_bid_id":"rapid-1"}`, bidder)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("first status = %d, body = %s", rec.Code, rec.Body.String())
	}

	req = authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", `{"amount_cents":200,"client_bid_id":"rapid-2"}`, bidder)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestLoginIsRateLimitedAfterRepeatedFailures(t *testing.T) {
	r := setupCommentTest(t)
	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	u := models.User{Username: "login-rate-limited", PasswordHash: string(hash)}
	if err := config.DB.Where("username = ?", u.Username).Delete(&models.User{}).Error; err != nil {
		t.Fatalf("cleanup user: %v", err)
	}
	if err := config.DB.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() { config.DB.Delete(&models.User{}, u.ID) })

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"username":"login-rate-limited","password":"wrong"}`))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d status = %d, body = %s", i+1, rec.Code, rec.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"username":"login-rate-limited","password":"wrong"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("rate limited status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestRegisterIsRateLimitedPerIP(t *testing.T) {
	r := setupCommentTest(t)
	// 清干净本次测试用户名前缀的脏数据
	config.DB.Where("username LIKE ?", "reg-throttle-%").Delete(&models.User{})
	t.Cleanup(func() {
		config.DB.Where("username LIKE ?", "reg-throttle-%").Delete(&models.User{})
	})

	// 10 次有效注册（每次用不同用户名）应该全部成功
	for i := 0; i < 10; i++ {
		body := `{"username":"reg-throttle-` + strconv.Itoa(i) + `","password":"password123"}`
		req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("attempt %d status = %d, body = %s", i+1, rec.Code, rec.Body.String())
		}
	}

	// 第 11 次同 IP 注册：超过 10/10min 上限 → 429
	body := `{"username":"reg-throttle-overflow","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after rate limit; got %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestBidAboveSystemMaximumIsRejected(t *testing.T) {
	r := setupCommentTest(t)
	oldMax := config.Get().MaxBidAmountCents
	config.Get().MaxBidAmountCents = 150
	t.Cleanup(func() { config.Get().MaxBidAmountCents = oldMax })
	bidder := createNamedUser(t, "bidder-max-amount")
	a := createCommentTestAuction(t)
	ends := time.Now().Add(time.Minute)
	a.CurrentPrice = 0
	a.StartPrice = 0
	a.StartPriceCents = 0
	a.CurrentPriceCents = 0
	a.PriceStep = 1
	a.PriceStepCents = 100
	a.CeilingPrice = nil
	a.CeilingPriceCents = nil
	a.Status = "active"
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", `{"amount_cents":200,"client_bid_id":"too-high-system"}`, bidder)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestReleaseSecurityValidationRequiresSecretAndOrigins(t *testing.T) {
	cfg := &config.Config{ServerMode: gin.ReleaseMode, JWTSecret: "", AllowedOrigins: nil}
	if err := config.ValidateSecurity(cfg); err == nil {
		t.Fatal("expected release security validation to fail")
	}
	cfg.JWTSecret = "a-very-long-release-secret"
	cfg.AllowedOrigins = []string{"https://example.com"}
	if err := config.ValidateSecurity(cfg); err != nil {
		t.Fatalf("expected valid release security config: %v", err)
	}
}

func floatPtr(v float64) *float64 {
	return &v
}
