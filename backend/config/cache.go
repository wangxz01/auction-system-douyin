package config

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"golang.org/x/sync/singleflight"
)

var cacheLoadGroup singleflight.Group

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

// CacheLoadJSON 读穿带 singleflight 防击穿。
// 同一进程内对相同 key 的并发未命中请求只会触发一次 loader，
// 其它请求等待同一份结果，避免热点 key 失效瞬间击穿到 MySQL。
// loader 返回的值会被 json.Marshal 后写入 Redis，并解码到 dest。
func CacheLoadJSON(key string, ttl time.Duration, dest any, loader func() (any, error)) error {
	if CacheGetJSON(key, dest) {
		return nil
	}
	rawAny, err, _ := cacheLoadGroup.Do(key, func() (any, error) {
		if Redis != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
			defer cancel()
			if bytes, err := Redis.Get(ctx, key).Bytes(); err == nil {
				return bytes, nil
			}
		}
		value, err := loader()
		if err != nil {
			return nil, err
		}
		bytes, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		if Redis != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
			defer cancel()
			if err := Redis.Set(ctx, key, bytes, ttl).Err(); err != nil {
				log.Printf("Redis 缓存写入失败 key=%s: %v", key, err)
			}
		}
		return bytes, nil
	})
	if err != nil {
		return err
	}
	return json.Unmarshal(rawAny.([]byte), dest)
}
