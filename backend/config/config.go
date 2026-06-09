package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort string
	ServerMode string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       string

	JWTSecret      string
	JWTExpireHours string

	AllowedOrigins []string
	AdminUsernames []string

	MaxBidAmountCents int64
	MaxWSConnections  int

	// 演示种子数据：首次启动时灌入预设用户/拍卖/出价/订单。
	// 已存在则自动跳过；详情见 docs/演示数据.md。
	SeedDemoData bool
}

var active *Config

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, falling back to process env")
	}

	cfg := &Config{
		ServerPort:     getEnv("SERVER_PORT", "8080"),
		ServerMode:     getEnv("SERVER_MODE", "debug"),
		DBHost:         getEnv("DB_HOST", "127.0.0.1"),
		DBPort:         getEnv("DB_PORT", "3306"),
		DBUser:         getEnv("DB_USER", "auction"),
		DBPassword:     getEnv("DB_PASSWORD", "auctionpass"),
		DBName:         getEnv("DB_NAME", "auction"),
		RedisHost:      getEnv("REDIS_HOST", "127.0.0.1"),
		RedisPort:      getEnv("REDIS_PORT", "6379"),
		RedisPassword:  getEnv("REDIS_PASSWORD", ""),
		RedisDB:        getEnv("REDIS_DB", "0"),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		JWTExpireHours: getEnv("JWT_EXPIRE_HOURS", "72"),
		AllowedOrigins: splitCSV(getEnv("ALLOWED_ORIGINS", "")),
		AdminUsernames: splitCSV(getEnv("ADMIN_USERNAMES", "")),

		MaxBidAmountCents: getEnvInt64("MAX_BID_AMOUNT_CENTS", 100000000),
		MaxWSConnections:  getEnvInt("WS_MAX_CONNECTIONS", 1000),

		SeedDemoData: getEnvBool("SEED_DEMO_DATA", false),
	}
	if cfg.ServerMode != "release" && cfg.JWTSecret == "" {
		cfg.JWTSecret = "dev-only-do-not-use-in-prod"
	}
	if cfg.ServerMode != "release" && len(cfg.AllowedOrigins) == 0 {
		cfg.AllowedOrigins = []string{"http://localhost:5173", "http://127.0.0.1:5173"}
	}
	return cfg
}

func SetActive(cfg *Config) {
	active = cfg
}

func Get() *Config {
	if active != nil {
		return active
	}
	active = Load()
	return active
}

func ValidateSecurity(cfg *Config) error {
	if cfg.ServerMode != "release" {
		return nil
	}
	if strings.TrimSpace(cfg.JWTSecret) == "" || cfg.JWTSecret == "dev-only-do-not-use-in-prod" {
		return fmt.Errorf("release 模式必须显式配置 JWT_SECRET")
	}
	if len(cfg.AllowedOrigins) == 0 {
		return fmt.Errorf("release 模式必须显式配置 ALLOWED_ORIGINS")
	}
	for _, origin := range cfg.AllowedOrigins {
		if origin == "*" {
			return fmt.Errorf("release 模式不允许 ALLOWED_ORIGINS 包含 *")
		}
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	raw := getEnv(key, "")
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func getEnvBool(key string, fallback bool) bool {
	raw := strings.ToLower(strings.TrimSpace(getEnv(key, "")))
	if raw == "" {
		return fallback
	}
	return raw == "1" || raw == "true" || raw == "yes" || raw == "on"
}

func getEnvInt64(key string, fallback int64) int64 {
	raw := getEnv(key, "")
	if raw == "" {
		return fallback
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return fallback
	}
	return v
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

/*
================================================================================
【本文件作用】backend/config/config.go（配置加载模块）
================================================================================
作用：把 .env 文件里的字符串变成代码能用的 Config 结构体。

为什么单独抽一个 config 包：
  1. 集中管理：所有配置项在一个文件里，谁也不许在业务代码里写 os.Getenv
  2. 类型安全：代码里用 cfg.DBHost 而不是 os.Getenv("DB_HOST")，IDE 能补全
  3. 默认值：万一 .env 丢了或漏配，能用默认值兜底，程序不会崩

关键函数：
  Load()      读 .env → 填充 Config → 返回指针
  getEnv()    内部工具：读环境变量，没值就用 fallback

godotenv.Load() 的工作原理：
  从当前工作目录找 .env 文件，把 KEY=VALUE 注入到进程的环境变量中。
  之后 os.LookupEnv("KEY") 就能读到。
  注意：必须在程序启动早期调用，否则后面 os.Getenv 就读不到了。

何时修改这个文件：
  - 新增配置项（比如要加 JWT_SECRET）：
      1. 在 Config 结构体里加字段
      2. 在 Load() 里加一行 getEnv("JWT_SECRET", "")
      3. 在 .env 和 .env.example 里加这个变量
================================================================================
*/
