# Auction System 拍卖系统

一个基于 **Go (Gin) + React (Vite + TypeScript) + MySQL + Redis** 的实时拍卖系统。

---

## 📌 当前进度

### ✅ 第一阶段：项目框架（已完成）

目标：把前端、后端、数据库三方环境跑通，前端能成功调用后端接口。

| 模块 | 状态 | 说明 |
|---|---|---|
| Go 后端框架 | ✅ | gin + gorm + redis + websocket + godotenv 依赖装好 |
| 后端目录结构 | ✅ | cmd / config / controllers / models / routes |
| `/health` 接口 | ✅ | 浏览器访问返回 JSON |
| `.env` 配置 | ✅ | 服务端口、数据库、Redis 全部参数化 |
| React + TS 前端 | ✅ | Vite 脚手架，dev server 跑在 5173 |
| 前端调后端 | ✅ | 首页用 fetch 调 `/health` 并展示结果 |
| MySQL 容器 | ✅ | Docker 启动，3306 端口可连 |
| Redis 容器 | ✅ | Docker 启动，6379 端口可连 |
| CORS 跨域 | ✅ | 后端允许 `http://localhost:5173` |

### ⏳ 后续阶段（未开始）

- **第二阶段**：后端真实连接 MySQL/Redis；定义用户、商品、出价等数据模型
- **第三阶段**：用户注册/登录、JWT 鉴权
- **第四阶段**：商品 CRUD、拍卖列表
- **第五阶段**：WebSocket 实时出价推送
- **第六阶段**：前端 UI 美化、部署

---

## 📁 项目结构

```
auction-system/
├── README.md                  # 你正在看的文件
├── docker-compose.yml         # 一键启动 MySQL + Redis
│
├── backend/                   # Go 后端
│   ├── go.mod / go.sum        # Go 依赖清单
│   ├── .env                   # 真实配置（不要提交 git）
│   ├── .env.example           # 配置模板（可提交）
│   ├── .gitignore
│   ├── cmd/server/main.go     # 程序入口
│   ├── config/config.go       # 加载 .env 配置
│   ├── controllers/           # 接口处理函数
│   │   └── health_controller.go
│   ├── routes/routes.go       # 路由注册 + CORS
│   └── models/                # 数据模型（待添加）
│
└── frontend/                  # React + TypeScript 前端
    ├── package.json
    ├── .env                   # VITE_API_BASE 指向后端
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        └── App.tsx            # 首页：调用 /health 并展示
```

---

## 🚀 快速启动

### 前置依赖

| 工具 | 版本 | 说明 |
|---|---|---|
| Go | ≥ 1.25 | 后端运行环境 |
| Node.js | ≥ 20 | 前端开发环境 |
| Docker (或 OrbStack) | 最新 | 跑 MySQL / Redis |

### 启动步骤

**1. 启动数据库容器**
```bash
cd /Users/adam/Desktop/auction-system
docker compose up -d
```
确认运行：
```bash
docker ps
```
应看到 `auction-mysql` 和 `auction-redis` 都是 `Up` 状态。

**2. 启动后端**（新开一个终端）
```bash
cd /Users/adam/Desktop/auction-system/backend
go run ./cmd/server
```
看到 `Listening and serving HTTP on :8080` 即成功。

浏览器访问 <http://localhost:8080/health>，应看到：
```json
{"service":"auction-system","status":"ok","time":"..."}
```

**3. 启动前端**（再开一个终端）
```bash
cd /Users/adam/Desktop/auction-system/frontend
npm install   # 首次需要
npm run dev
```
浏览器访问 <http://localhost:5173/>，应看到绿字 JSON 显示后端健康状态。

### 停止

```bash
docker compose down       # 停容器（保留数据）
docker compose down -v    # 停容器并删除数据卷
```
后端 / 前端在各自终端按 `Ctrl+C` 终止。

---

## 🔧 配置说明

### 后端 `backend/.env`

```env
SERVER_PORT=8080
SERVER_MODE=debug          # debug / release

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=auction
DB_PASSWORD=auctionpass
DB_NAME=auction

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 前端 `frontend/.env`

```env
VITE_API_BASE=http://localhost:8080
```
> ⚠️ Vite 规定：**只有以 `VITE_` 开头的环境变量**才会暴露给浏览器代码。

### 数据库连接（TablePlus / DBeaver）

| 字段 | MySQL | Redis |
|---|---|---|
| Host | 127.0.0.1 | 127.0.0.1 |
| Port | 3306 | 6379 |
| 用户名 | `auction`（root 密码 `rootpass`） | — |
| 密码 | `auctionpass` | 无 |
| 数据库 | `auction` | DB 0 |

---

## 🧰 技术栈说明

### 后端依赖

| 包 | 作用 |
|---|---|
| `github.com/gin-gonic/gin` | HTTP 框架（类似 Express） |
| `github.com/gin-contrib/cors` | 跨域中间件 |
| `gorm.io/gorm` + `gorm.io/driver/mysql` | ORM，把 Go 结构体映射成数据表 |
| `github.com/redis/go-redis/v9` | Redis 客户端 |
| `github.com/gorilla/websocket` | WebSocket（实时出价用） |
| `github.com/joho/godotenv` | 读取 `.env` 文件 |

### 前端依赖

由 `npm create vite@latest --template react-ts` 自动安装：React 19、React-DOM、TypeScript、Vite。

---

## 📝 常见问题

**Q: `docker compose up` 报错 "Cannot connect to the Docker daemon"？**
A: Docker / OrbStack 没启动。Mac 上执行 `open -a OrbStack` 或打开 Docker Desktop。

**Q: 前端打开后显示 "Error: ..."？**
A: 后端没启或 CORS 没生效。检查 8080 端口是否能 `curl http://localhost:8080/health`。

**Q: 后端报 "go: ... requires go >= 1.25.0"？**
A: Go 工具链会自动下载新版本，等一会儿即可，不用手动升级。

**Q: 改了 `.env` 不生效？**
A: 后端 `.env` 改完要重启 `go run`；前端 `.env` 改完要重启 `npm run dev`。

---

## 📅 更新记录

- **2026-05-22** — 完成第一阶段：项目框架搭建、前后端联调成功
