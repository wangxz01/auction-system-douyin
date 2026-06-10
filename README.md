# Auction System 拍卖系统

> 抖音电商 AI 全栈挑战赛参赛项目。基于 **Go (Gin) + React (Vite + TypeScript) + MySQL + Redis** 的实时直播竞拍系统，面向"直播间高并发出价 + 状态机强一致 + 实时同步"场景。

完整开发记录、阶段说明、压测数据、已知不足等详见 [README.full.md](./README.full.md)。

---

## 1. 项目简介

- **业务定位**：抖音电商直播场景下的实时拍卖平台,用户在 H5 直播间出价,商家在 PC 后台发布商品与管理订单。
- **核心能力**:
  - 实时出价 + WebSocket 同步(按竞拍房间隔离,5 类事件广播)
  - 复杂竞拍规则:0 元起拍、固定加价幅度、封顶价、10-30 秒自动延时、状态机不可逆
  - 高并发一致性:Redis 短锁 + MySQL 事务 + `SELECT … FOR UPDATE` + `client_bid_id` 幂等 + 订单唯一索引
  - 可观测性:`/admin/metrics` 5 项指标 + `/admin/alerts` 4 类告警 + 6 类行为埋点
- **强隔离**:用户端(H5 / 移动端)与商家端(PC / 管理后台)路由完全分离,无互相跳转入口。
- **演示数据**:`SEED_DEMO_DATA=true` 首启自动灌入 14 个 demo 账号 + 8 场拍卖 + 出价 / 评论 / 订单历史。

---

## 2. 依赖环境

| 工具 | 版本 | 用途 |
|---|---|---|
| Go | ≥ 1.25 | 后端运行环境 |
| Node.js | ≥ 20 | 前端开发环境 |
| Docker(或 OrbStack) | 最新 | 跑 MySQL 8 / Redis 7 容器 |
| MySQL | 8.x(容器内置) | 数据持久化 |
| Redis | 7.x(容器内置) | 读缓存 + 出价短锁 |

**后端关键依赖**:`gin` / `gorm` + `mysql driver` / `gorilla/websocket` / `go-redis/v9` / `joho/godotenv` / `golang-jwt` / `bcrypt`。

**前端关键依赖**:`react 19` / `react-router-dom` / `axios` / `vite` / `@tailwindcss/vite` / `hls.js`。

---

## 3. 启动步骤

**1. 启动数据库容器**

```bash
cd /Users/adam/Desktop/auction-system
docker compose up -d
docker ps   # 确认 auction-mysql / auction-redis 都 Up
```

**2. 启动后端**(新终端)

```bash
cd backend
cp .env.example .env   # 首次需要,然后按需修改
go run ./cmd/server
```

看到 `Listening and serving HTTP on :8080` 即成功。访问 <http://localhost:8080/health> 应返回 JSON。

**3. 启动前端**(再开一个终端)

```bash
cd frontend
npm install   # 首次需要
npm run dev
```

浏览器访问 <http://localhost:5173/>。

**4. 演示数据(可选)**

在 `backend/.env` 设置 `SEED_DEMO_DATA=true` 后重启后端,会自动灌入演示账号与拍卖。完整账号清单见 [docs/演示数据.md](./docs/演示数据.md)。

**5. 停止**

```bash
docker compose down       # 停容器(保留数据)
docker compose down -v    # 停容器并删除数据卷
```

前后端在各自终端按 `Ctrl+C` 终止。

---

## 4. 目录结构

```
auction-system/
├── README.md                  # 本文件(简版)
├── README.full.md             # 完整开发记录(阶段、压测、已知不足)
├── 成果演示DEMO.md             # 比赛成果演示文档
├── docker-compose.yml         # 一键启动 MySQL + Redis
├── docs/                      # 设计、演示、部署、压测、AI 使用文档
├── deploy/                    # 生产 Docker Compose + Nginx + 环境变量模板
│
├── backend/                   # Go 后端
│   ├── cmd/server/main.go    # 程序入口
│   ├── config/               # 配置 / DB / Redis / 缓存 / 调度器 / seed
│   ├── controllers/          # auth / auction / bid / order / ws / admin_*
│   ├── middleware/auth.go   # JWT 签发 + 验证
│   ├── ws/hub.go            # WebSocket 房间管理
│   ├── routes/routes.go     # 路由注册 + CORS
│   ├── models/              # User / Merchant / Auction / Bid / Order / Comment / UserEvent
│   ├── Dockerfile           # 生产镜像
│   └── .env.example         # 配置模板
│
└── frontend/                 # React + TypeScript 前端
    ├── src/
    │   ├── App.tsx          # 路由表(懒加载)
    │   ├── api/client.ts    # axios + JWT 拦截器
    │   ├── lib/             # types / auth / ws / paddle / icons
    │   ├── components/      # 公共组件 + components/live/(直播间子组件)
    │   └── pages/           # UserHall / AuctionDetail / Me / Login / OrderPage / Admin*
    ├── Dockerfile
    └── nginx.default.conf
```

详细模型字段、API 路由清单见 [README.full.md](./README.full.md)。

---

## 5. 配置说明

### 后端 `backend/.env`

```env
SERVER_PORT=8080
SERVER_MODE=debug              # debug / release

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=auction
DB_PASSWORD=auctionpass
DB_NAME=auction

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRE_HOURS=72
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ADMIN_USERNAMES=admin
MAX_BID_AMOUNT_CENTS=100000000
WS_MAX_CONNECTIONS=1000
SEED_DEMO_DATA=false
```

| 字段 | 说明 |
|---|---|
| `SERVER_MODE=release` | 生产模式必须显式配置 `JWT_SECRET` 和 `ALLOWED_ORIGINS`,且 `ALLOWED_ORIGINS` 不能为 `*` |
| `ADMIN_USERNAMES` | 逗号分隔的超级管理员用户名列表(按 username 判断,不依赖固定 ID) |
| `MAX_BID_AMOUNT_CENTS` | 系统级单笔出价上限(分) |
| `WS_MAX_CONNECTIONS` | 单后端进程 WebSocket 最大连接数 |
| `SEED_DEMO_DATA` | 首启自动灌入演示数据,仅本地/受控环境开启 |

### 前端 `frontend/.env`

```env
VITE_API_BASE=http://localhost:8080
```

> Vite 规定:**只有以 `VITE_` 开头的环境变量**才会暴露给浏览器代码。生产模式下前端默认使用当前域名同源访问 `/api` 和 `wss://.../ws`。

### 数据库连接(TablePlus / DBeaver)

| 字段 | MySQL | Redis |
|---|---|---|
| Host | 127.0.0.1 | 127.0.0.1 |
| Port | 3306 | 6379 |
| 用户名 | `auction`(root 密码 `rootpass`) | — |
| 密码 | `auctionpass` | 无 |
| 数据库 | `auction` | DB 0 |

### 超级管理员账号

1. `backend/.env` 保持 `ADMIN_USERNAMES=admin`
2. 重启后端让配置生效
3. 前端登录 `admin` 账号
4. 访问 `/admin`、`/admin/create`、`/admin/orders` 管理竞拍、商家和订单

多个管理员可用英文逗号分隔,例如 `ADMIN_USERNAMES=admin,root,boss`。

---

## 📚 更多文档

- [README.full.md](./README.full.md) — 完整开发记录、阶段说明、API 清单、数据模型、压测数据、已知不足
- [成果演示DEMO.md](./成果演示DEMO.md) — 比赛参赛成果演示文档
- [docs/design.md](./docs/design.md) — 架构、状态机、并发、权限方案
- [docs/demo.md](./docs/demo.md) — 3-5 分钟演示闭环脚本
- [docs/deployment.md](./docs/deployment.md) — 生产服务器部署说明
- [docs/performance.md](./docs/performance.md) — 压测方法与结果
- [docs/ai-usage.md](./docs/ai-usage.md) — AI 使用流程与人工把控边界
- [docs/演示数据.md](./docs/演示数据.md) — 演示账号与后台操作说明
