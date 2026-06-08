package config

import (
	"context"
	"encoding/json"
	"log"
	"time"
)

func CacheGetJSON(key string, dest any) bool {
	if Redis == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	raw, err := Redis.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	if err := json.Unmarshal(raw, dest); err != nil {
		log.Printf("Redis 缓存反序列化失败 key=%s: %v", key, err)
		return false
	}
	return true
}

func CacheSetJSON(key string, value any, ttl time.Duration) {
	if Redis == nil {
		return
	}
	raw, err := json.Marshal(value)
	if err != nil {
		log.Printf("Redis 缓存序列化失败 key=%s: %v", key, err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	if err := Redis.Set(ctx, key, raw, ttl).Err(); err != nil {
		log.Printf("Redis 缓存写入失败 key=%s: %v", key, err)
	}
}

func CacheDel(keys ...string) {
	if Redis == nil || len(keys) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	if err := Redis.Del(ctx, keys...).Err(); err != nil {
		log.Printf("Redis 缓存删除失败 keys=%v: %v", keys, err)
	}
}
