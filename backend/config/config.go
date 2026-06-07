package config

import (
	"log"
	"os"

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
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, falling back to process env")
	}

	return &Config{
		ServerPort:    getEnv("SERVER_PORT", "8080"),
		ServerMode:    getEnv("SERVER_MODE", "debug"),
		DBHost:        getEnv("DB_HOST", "127.0.0.1"),
		DBPort:        getEnv("DB_PORT", "3306"),
		DBUser:        getEnv("DB_USER", "auction"),
		DBPassword:    getEnv("DB_PASSWORD", "auctionpass"),
		DBName:        getEnv("DB_NAME", "auction"),
		RedisHost:     getEnv("REDIS_HOST", "127.0.0.1"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword:  getEnv("REDIS_PASSWORD", ""),
		RedisDB:        getEnv("REDIS_DB", "0"),
		JWTSecret:      getEnv("JWT_SECRET", "dev-only-do-not-use-in-prod"),
		JWTExpireHours: getEnv("JWT_EXPIRE_HOURS", "72"),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
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

