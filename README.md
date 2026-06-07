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

### ✅ 第三阶段：WebSocket 实时通信（已完成）

目标：在关键业务节点向所有在线客户端实时推送事件，替代轮询。

| 模块 | 状态 | 说明 |
|---|---|---|
| Hub 房间管理器 | ✅ | `ws/hub.go`，按 `auction_id` 分房间，goroutine + channel 串行化所有操作 |
| WS 连接接口 | ✅ | `controllers/ws.go`，HTTP → WebSocket 升级，readPump/writePump 双 goroutine |
| 心跳保活 | ✅ | 每 30s ping，60s 无消息断开 |
| 事件广播 | ✅ | start / cancel / new_bid / finished 四类事件接入 |
| 路由 | ✅ | `GET /ws/auctions/:id` |
| E2E 测试 | ✅ | 两个客户端并发订阅，验证广播、断开互不影响 |

**事件消息格式**

```jsonc
// 竞拍开始
{"type":"auction_started","auction_id":1,"ends_at":"..."}

// 新出价（每次出价后广播）
{"type":"new_bid","auction_id":1,"current_price":130,"winner_id":2,
 "ends_at":"...","top_bids":[{"user_id":2,"amount":130},...]}

// 竞拍结束（封顶价命中 或 定时器到期触发）
{"type":"auction_finished","auction_id":1,"final_price":150,"winner_id":3}

// 竞拍取消
{"type":"auction_cancelled","auction_id":1}
```

**前端连接方式**

```js
const ws = new WebSocket(`ws://localhost:8080/ws/auctions/${auctionID}`)
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  switch (msg.type) {
    case 'auction_started':   /* ... */ break
    case 'new_bid':           /* ... */ break
    case 'auction_finished':  /* ... */ break
    case 'auction_cancelled': /* ... */ break
  }
}
```

### ✅ 第二阶段：后端业务接口（已完成）

目标：实现拍卖系统全部核心后端接口，含数据库连接、模型、竞拍/出价/订单业务、定时任务。

| 模块 | 状态 | 说明 |
|---|---|---|
| 数据库连接 | ✅ | `config/db.go` 用 GORM 连 MySQL，启动时 AutoMigrate 建表 |
| 数据模型 | ✅ | `models/` 下 User / Auction / Bid / Order 四个结构体 |
| 竞拍接口 | ✅ | 创建 / 列表 / 详情 / 开始 / 取消，5 个接口 |
| 出价接口 | ✅ | 出价（含加价/封顶/自动延时校验）+ Top10 排行榜 |
| 订单接口 | ✅ | 按 auction_id 查订单 + 内部 createOrder 封装 |
| 定时任务 | ✅ | `config/scheduler.go` 每 5s 扫描过期 active 竞拍，自动 finished 并生成订单 |
| CORS | ✅ | 已放开为允许所有来源 |
| E2E 测试 | ✅ | curl 全流程跑通：创建→开始→出价→封顶/超时→查订单 |

**已注册路由清单**

```
GET    /health
POST   /api/auctions
GET    /api/auctions
GET    /api/auctions/:id
POST   /api/auctions/:id/start
POST   /api/auctions/:id/cancel
POST   /api/auctions/:id/bids
GET    /api/auctions/:id/bids
GET    /api/auctions/:id/order
```

**业务规则要点**

- 所有成功响应 `{"data": ...}`，失败响应 `{"error": "原因"}`
- 出价校验顺序：状态 → 是否过期 → 加价幅度 → 封顶价
- 加价规则：`amount = current_price + n × price_step` (n ≥ 1)
- 自动延时：距 `ends_at` 不足 30s 出价 → ends_at 延后到 30s
- 封顶价命中：立即 finished + 生成订单
- 定时器幂等：用条件更新避免与封顶价路径重复生成订单
- 订单表 `auction_id` 加唯一索引，双保险

### ⏳ 后续阶段（未开始）

- **第四阶段**：前端业务页面（竞拍列表、详情、出价 UI），对接 WebSocket 实时刷新
- **第五阶段**：用户系统（注册/登录、JWT 鉴权）
- **第六阶段**：UI 美化、生产部署

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
│   ├── cmd/server/main.go     # 程序入口（启动时初始化 DB + 定时器）
│   ├── config/
│   │   ├── config.go          # 加载 .env 配置
│   │   ├── db.go              # GORM 连 MySQL + AutoMigrate
│   │   └── scheduler.go       # 5s 定时扫描过期竞拍
│   ├── controllers/           # 接口处理函数
│   │   ├── health_controller.go
│   │   ├── auction.go         # 竞拍 CRUD + 开始/取消（含 WS 广播）
│   │   ├── bid.go             # 出价 + Top10 排行（含 WS 广播）
│   │   ├── order.go           # 查询订单 + 内部 createOrder
│   │   └── ws.go              # WebSocket 升级 + 心跳泵
│   ├── ws/
│   │   └── hub.go             # WebSocket 房间管理器（按 auction_id 分房）
│   ├── routes/routes.go       # 路由注册 + CORS
│   └── models/                # 数据模型
│       ├── user.go
│       ├── auction.go
│       ├── bid.go
│       └── order.go           # 含 CreateOrderForAuction 工具函数
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

## 🗂️ 数据模型

数据库 `auction` 共 4 张表，GORM 启动时 AutoMigrate 自动建好。所有主键 `bigint unsigned`，价格 `decimal(12,2)`（精确到分），时间 `datetime(3)`（毫秒精度）。

### `auctions`（竞拍主表）

> 命名说明：原任务描述中称为"商品表 `auction_items`"，本项目把"商品"和"竞拍场次"合并到一张表（小项目惯例），表名保留 `auctions`。后续若出现"同一商品多次开拍"再拆表。

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | 主键 |
| `title` | varchar(255) | — | 商品标题 |
| `description` | text | — | 商品描述 |
| `image_url` | varchar(512) | — | 主图 URL |
| `start_price` | decimal(12,2) | — | 起拍价 |
| `price_step` | decimal(12,2) | — | 加价幅度 |
| `ceiling_price` | decimal(12,2) | — | 封顶价（可空） |
| `current_price` | decimal(12,2) | — | 当前价 |
| `duration_seconds` | bigint | — | 持续秒数 |
| `status` | varchar(16) | IDX | pending / active / finished / cancelled |
| `winner_id` | bigint unsigned | — | 中标用户（可空） |
| `started_at` | datetime(3) | — | 开始时间 |
| `ends_at` | datetime(3) | IDX | 结束时间（定时器扫描此字段） |
| `created_at`/`updated_at` | datetime(3) | — | 时间戳 |

### `bids`（出价流水表，只增不改）

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | |
| `auction_id` | bigint unsigned | IDX | 哪场竞拍 |
| `user_id` | bigint unsigned | IDX | 出价人 |
| `amount` | decimal(12,2) | — | 出价金额 |
| `created_at` | datetime(3) | — | 出价时间 |

### `orders`（订单表）

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | |
| `auction_id` | bigint unsigned | **UNIQUE** | 一场拍卖最多一个订单 |
| `user_id` | bigint unsigned | IDX | 中标用户 |
| `final_price` | decimal(12,2) | — | 成交价 |
| `status` | varchar(16) | — | 默认 pending（后续可扩 paid/shipped） |
| `created_at`/`updated_at` | datetime(3) | — | 时间戳 |

### `users`（用户表，占位）

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | |
| `username` | varchar(64) | UNIQUE | 用户名 |
| `created_at`/`updated_at` | datetime(3) | — | |

> 当前业务不依赖用户记录（user_id 由前端直传），表先占位。后续接入注册/登录时再补 `password_hash`、`email` 等字段。

### 状态机

```
pending(未开始) ──/start──→ active(进行中) ──自然到期/触达封顶──→ finished(已结束)
       │                          │
       └────/cancel────→ cancelled(已取消) ←────/cancel────┘
```

- pending：只能 start 或 cancel
- active：可出价、可 cancel；定时器扫描 `ends_at`；触达 `ceiling_price` 立即结束
- finished / cancelled：只读，不可逆

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

- **2026-06-07** — 完成第三阶段：WebSocket 实时通信，4 类事件接入，多客户端 E2E 验证通过
- **2026-06-07** — 完成第二阶段：后端业务接口全部实现，含 9 条 API + 定时任务，E2E 测试通过
- **2026-05-22** — 完成第一阶段：项目框架搭建、前后端联调成功

---

<!--
================================================================================
【本文件作用】README.md（项目根目录）
================================================================================
作用：整个拍卖系统项目的"门面文档"和"使用说明书"。
任何人（包括未来的你）打开 GitHub 仓库时，第一眼看到的就是这个文件。

包含内容：
  1. 项目简介（用了什么技术栈）
  2. 当前进度（哪些阶段完成、哪些未完成）
  3. 项目目录结构总览
  4. 快速启动步骤（怎么跑起来）
  5. 配置说明（.env 各字段含义）
  6. 数据库连接信息（给 TablePlus / DBeaver 用）
  7. 技术栈说明（每个依赖包是干嘛的）
  8. 常见问题（FAQ）
  9. 更新记录

为什么放在根目录：
  GitHub 会自动识别根目录的 README.md 并渲染到仓库首页。
  这是开源项目的"行业潜规则"，必须放这里。

何时更新：
  - 完成一个阶段时，更新"当前进度"和"更新记录"
  - 新增依赖或配置项时，更新"技术栈"或"配置说明"
  - 遇到新坑时，补充到"常见问题"
================================================================================
-->

