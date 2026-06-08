package config

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

var Redis *redis.Client

func InitRedis(cfg *Config) {
	db, err := strconv.Atoi(cfg.RedisDB)
	if err != nil {
		db = 0
	}
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisHost + ":" + cfg.RedisPort,
		Password: cfg.RedisPassword,
		DB:       db,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️ Redis 连接失败，出价分布式锁降级为数据库行锁: %v", err)
		Redis = nil
		return
	}
	Redis = client
	log.Println("✅ Redis 连接成功")
}

func WithAuctionBidLock(ctx context.Context, auctionID uint, value string, ttl time.Duration) (func(), bool) {
	if Redis == nil {
		return func() {}, true
	}
	key := "auction:bid-lock:" + strconv.FormatUint(uint64(auctionID), 10)
	ok, err := Redis.SetNX(ctx, key, value, ttl).Result()
	if err != nil {
		log.Printf("Redis 出价锁失败，降级为数据库行锁 auction=%d: %v", auctionID, err)
		return func() {}, true
	}
	if !ok {
		return func() {}, false
	}
	release := func() {
		script := redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`)
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := script.Run(ctx, Redis, []string{key}, value).Err(); err != nil {
			log.Printf("Redis 出价锁释放失败 auction=%d: %v", auctionID, err)
		}
	}
	return release, true
}
