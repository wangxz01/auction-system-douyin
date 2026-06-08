# Auction System 拍卖系统

一个基于 **Go (Gin) + React (Vite + TypeScript) + MySQL + Redis** 的实时拍卖系统。

---

## 🚪 两端入口（默认 dev 地址）

> **强隔离**：用户端和商家端没有任何互相跳转的入口，按业务边界各自独立。商家入口只能从用户端「我的」页面进入。

### 🛒 用户端（消费者 / 移动端 H5）

| 路由 | 页面 | 说明 |
|---|---|---|
| <http://localhost:5173/> | 大厅 | 进行中 & 未开始的竞拍列表 |
| `/auction/:id` | 详情 | 实时出价 + 倒计时 + 排行（WebSocket） |
| `/auction/:id/order` | 订单 | 中标后查看 + 模拟支付（需登录） |
| `/me` | 我的 | 用户信息 + 退出 + 商家后台入口 |
| `/login` | 登录 | 登录 / 注册切换 |

底部固定 Tab 栏：🏠 大厅 / 👤 我的（仅在大厅 + 我的页面显示，详情/订单页不显示）

### 🛠️ 商家端（管理后台 / PC 宽屏）

固定的左侧导航栏（参考桌面 App 风格），右侧大块内容区。商家端**没有任何回跳用户端的入口**，与用户端完全隔离。

当前开发环境已创建 `admin` 账号，并通过后端环境变量 `ADMIN_USERNAMES=admin` 设置为超级管理员。使用 `admin` 登录后可进入 `/admin` 系列页面，管理全部竞拍、商家和订单。普通商家账号需要先在 `merchants` 表中处于 `active` 状态，只能管理自己发布的竞拍和订单。

| 路由 | 页面 | 说明 |
|---|---|---|
| <http://localhost:5173/admin> | 竞拍管理 | 全部竞拍表格 + 行内开始/取消（需登录） |
| `/admin/auctions/:id` | 商品详情 | 商品信息 + 规则查看/编辑（未开始）+ 出价历史 + 订单 + 开始/取消 |
| `/admin/create` | 发布商品 | 创建新竞拍，支持图片上传或图片 URL |
| `/admin/orders` | 订单管理 | 查看当前商家的成交订单和对应竞拍 |

左侧栏：🏷️ Logo · 📋 竞拍管理 · ➕ 发布商品 · 🧾 订单管理 · 👤 当前账号 · ↩ 退出

> 用户端页面按手机尺寸设计。桌面浏览器访问会自动套一个 iPhone 形状的边框（含灵动岛 + 状态栏），底部 Tab 栏锚定在手机屏幕内部，整体视觉就像一台真机摆在桌面上。窗口宽度 < 768px 时（真机访问或开发者工具切到移动模式）边框自动隐藏。

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

### ✅ 第六阶段：UI 美化 · 液态玻璃风（已完成）

目标：把前端从「能用」升级到「好看」——参考截图的暖色调极简风 + iOS 26 液态玻璃。

| 模块 | 状态 | 说明 |
|---|---|---|
| 设计系统 | ✅ | `index.css` 集中定义颜色 token / 玻璃工具类 / 按钮 / FAB |
| 暖色 mesh 背景 | ✅ | 4 层径向渐变（暖黄/暖橙/粉/暖白），fixed 不滚 |
| `.glass` 工具类 | ✅ | `backdrop-filter: blur(24px) saturate(180%)` + 内嵌高光 |
| `.glass-strong` / `.glass-warm` / `.glass-soft` | ✅ | 不同强度变体 |
| `.btn-accent` | ✅ | 黄橙渐变 + 内外阴影 + hover 上浮 |
| `.fab` | ✅ | 商家列表悬浮加号按钮 |
| `.pill-group` / `.pill-tab` | ✅ | 登录页登录/注册切换 |
| 配色统一 | ✅ | 主色 `#FFB627`/`#FF9500`；StatusBadge 改用玻璃色彩 |
| 微动效 | ✅ | `flash-pop`（出价后价格高亮）+ `fade-up`（卡片进场） |
| 6 个页面全部重做 | ✅ | UserHall / AuctionDetail / OrderPage / AdminList / AdminCreate / Login |
| 生产构建 | ✅ | 302 KB JS / 30 KB CSS |

### ✅ 第七阶段：后端核心加固（已完成）

目标：补齐拍卖核心正确性、权限边界和生产安全配置。

| 模块 | 状态 | 说明 |
|---|---|---|
| 出价事务 | ✅ | `PlaceBid` 使用事务 + `SELECT ... FOR UPDATE`，避免并发低价覆盖高价 |
| 金额整数化 | ✅ | 新增 `*_cents` 字段，核心校验按“分”计算，旧元字段保留兼容 |
| 商家权限 | ✅ | 新增 `merchants` 表，创建/开始/取消竞拍要求商家或管理员 |
| 商家管理 | ✅ | `ADMIN_USERNAMES` 指定管理员，可创建/禁用商家 |
| 订单保护 | ✅ | 订单查询需登录，仅中标用户、竞拍商家或管理员可看 |
| 生产安全配置 | ✅ | release 模式必须显式配置 `JWT_SECRET` 和 `ALLOWED_ORIGINS` |
| 评论历史一致性 | ✅ | 不存在的竞拍评论历史返回 404 |
| 后端测试 | ✅ | 覆盖评论、权限、金额分字段、订单保护、并发出价和安全配置 |

### ✅ 第八阶段：商家后台基础补齐（已完成）

目标：补齐商家/主播端的发布、商品管理和订单管理基础工作流，界面先保持简单可用。

| 模块 | 状态 | 说明 |
|---|---|---|
| 图片上传 | ✅ | `POST /api/admin/uploads/images` 保存图片并返回可访问 URL |
| 延时机制配置 | ✅ | 创建/编辑竞拍时可配置 `auto_extend_seconds` |
| 未开始竞拍编辑 | ✅ | `PUT /api/auctions/:id` 仅允许修改 pending 竞拍 |
| 订单管理页 | ✅ | `/admin/orders` 查看商家的成交订单 |
| 后端测试 | ✅ | 覆盖编辑规则、订单列表、上传图片和自定义延时 |

### ✅ 第九阶段：用户端竞价体验与高并发补强（已完成）

目标：围绕“复杂规则零漏洞”和“毫秒级实时同步”补齐验收重点，用户端保持简单可用但链路完整。

| 模块 | 状态 | 说明 |
|---|---|---|
| 0 元起拍 | ✅ | `start_price_cents` 允许为 0，首次有效出价仍需满足固定加价幅度 |
| 自动延时范围 | ✅ | `auto_extend_seconds` 限制为 10-30 秒，缺省 30 秒 |
| 出价幂等 | ✅ | `client_bid_id` + 数据库唯一索引，同一用户同一竞拍同一点击只落库一次 |
| Redis 出价锁 | ✅ | Redis 可用时对单场竞拍加短 TTL 分布式锁；Redis 不可用时降级到数据库行锁 |
| Redis 读缓存 | ✅ | 竞拍列表/详情/统计使用短 TTL 缓存，写路径统一失效 |
| 实时同步字段 | ✅ | `new_bid` 广播参与人数、是否延时、服务器时间、Top 排行 |
| 毫秒倒计时 | ✅ | 前端 100ms 刷新，并根据后端 `server_time` 做时钟偏移校准 |
| 竞价氛围 | ✅ | 领先/被超越/延时/结束 toast，价格动画，提示音，实时排行榜 |
| 用户历史 | ✅ | `/me/bids` 浏览参与过的竞拍，`/me/orders` 浏览成交订单 |
| 重连补偿 | ✅ | WebSocket 重连成功后重新拉取详情、统计和评论，补偿断线期间丢失消息 |
| 轻量监控 | ✅ | `GET /api/admin/metrics` 返回活跃竞拍、WS 在线、今日出价、DB/Redis 状态 |
| 后端限流 | ✅ | 同一用户同一竞拍 700ms 内不同幂等键重复出价返回 429 |
| 项目材料 | ✅ | 新增 `docs/demo.md`、`docs/design.md`、`docs/ai-usage.md`、`docs/performance.md` |
| 后端测试 | ✅ | 覆盖 0 元起拍、延时范围、幂等出价、限流、metrics、实时广播元数据 |

### ✅ 第十阶段：生产部署准备（已完成）

目标：补齐部署到自有服务器和域名所需的生产文件与说明；真实上线需替换域名、证书和强密码。

| 模块 | 状态 | 说明 |
|---|---|---|
| 后端镜像 | ✅ | `backend/Dockerfile` 多阶段构建 Go release 二进制 |
| 前端镜像 | ✅ | `frontend/Dockerfile` 构建静态资源并用 Nginx 托管 |
| 生产编排 | ✅ | `deploy/docker-compose.prod.yml` 编排 MySQL、Redis、后端、前端、Nginx |
| Nginx 反代 | ✅ | `deploy/nginx.conf` 支持 `/api`、`/ws`、`/uploads` 和 HTTPS |
| 生产环境模板 | ✅ | `deploy/.env.prod.example` 列出 release 必填配置 |
| 部署文档 | ✅ | `docs/deployment.md` 说明服务器部署、证书、启动和排错 |
| 生产 API 地址 | ✅ | 前端生产环境默认使用当前域名，同源访问 `/api` 和 `wss://.../ws` |

### ✅ 第十一阶段：可观测性 / 缓存防击穿 / 行为埋点（已完成）

目标：补齐"竞拍状态监控、异常告警、热点 key 防击穿、用户行为采集"等评审硬性指标。

| 模块 | 状态 | 说明 |
|---|---|---|
| 缓存防击穿 | ✅ | `config/cache.go` 新增 `CacheLoadJSON`，基于 `singleflight` 同 key 并发未命中只触发一次 loader，配套单测 `TestCacheLoadJSONDedupsConcurrentLoads` 验证 20 并发只执行 1 次 |
| 热点读路径切换 | ✅ | `GetAuctions` / `GetAuction` / `GetAuctionStats` 三个高频接口接入新缓存 |
| 管理端告警接口 | ✅ | `GET /api/admin/alerts` 返回 4 类结构化告警：`db_unavailable` / `redis_unavailable` / `stale_active_auction` / `ws_capacity_high` |
| metrics 集成告警计数 | ✅ | `GET /api/admin/metrics` 新增 `alert_count` 字段，前端可轮询一个接口判断是否展开告警 |
| 用户行为埋点 | ✅ | `models/UserEvent` 表 + `POST /api/auctions/:id/events`，记录 `event_type` / `metadata` / `user_agent` |
| 行为指标 | ✅ | `metrics.total_events_today` 暴露今日埋点总数 |
| 测试覆盖 | ✅ | `cache_test.go`、`admin_alerts_test.go`（权限/stale 告警/alert_count）、`event_test.go`（落库/空类型拒绝） |

**告警分级：**

| code | severity | 触发条件 |
|---|---|---|
| `db_unavailable` | critical | DB ping 200ms 内失败 |
| `redis_unavailable` | warning | Redis ping 200ms 内失败（系统自动降级到 MySQL 行锁） |
| `stale_active_auction` | warning | 竞拍 `ends_at` 已过但仍为 `active`，等待 5s 调度器收尾 |
| `ws_capacity_high` | warning | WebSocket 在线连接达到 `WS_MAX_CONNECTIONS` 的 80% |

**埋点请求示例：**

```bash
curl -X POST http://localhost:8080/api/auctions/123/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"enter_room","metadata":"{\"source\":\"hall\"}"}'
```

详细设计见 `docs/design.md` §9 与 `docs/ai-usage.md`。

### ✅ 第五阶段：用户系统（已完成）

目标：真实注册/登录、JWT 鉴权、敏感接口保护、前端身份持久化。

| 模块 | 状态 | 说明 |
|---|---|---|
| User 表加 PasswordHash | ✅ | bcrypt 哈希，`json:"-"` 防泄漏 |
| `POST /api/auth/register` | ✅ | 用户名 2~32 字符；密码 ≥ 6 位；返回 token |
| `POST /api/auth/login` | ✅ | bcrypt 比对；错误统一回「用户名或密码错误」 |
| `GET /api/auth/me` | ✅ | 凭 JWT 返回当前用户信息 |
| JWT 中间件 | ✅ | `middleware/auth.go`，签发 + 验证 + 注入 `user_id` 到 gin.Context |
| 路由分组保护 | ✅ | GET 公开；POST 三类（创建/开始/取消/出价）需登录 |
| place_bid 改用 JWT | ✅ | body 不再接收 user_id，从 token 取，**杜绝伪造身份** |
| 前端 `lib/auth.ts` | ✅ | token/user 存 localStorage |
| axios 拦截器 | ✅ | 自动附 `Authorization: Bearer xxx`；401 跳 `/login?from=...` |
| `/login` 页 | ✅ | 登录/注册 tab 切换；登录后跳回原路径 |
| `<RequireAuth>` 包裹 | ✅ | `/admin`、`/admin/create`、订单页未登录跳登录 |
| 顶部用户名 + 退出 | ✅ | UserHall / AdminList 展示登录态 |

**鉴权流程**

```
浏览器                                      后端
  │  POST /api/auth/register {user,pw}      │
  │ ───────────────────────────────────────►│ bcrypt 加密 + 入库
  │                                         │ 签发 JWT (HS256, 72h)
  │ ◄──────────────────────────────── {token}│
  │  localStorage.setItem('auction_token')   │
  │                                         │
  │  POST /api/auctions/:id/bids             │
  │  Authorization: Bearer <token>           │
  │ ───────────────────────────────────────►│ 中间件验证 JWT
  │                                         │ user_id 注入 context
  │                                         │ 业务逻辑用 ctx 里的 uid
  │ ◄────────────────────────── {data: ...}  │
```

### ✅ 第四阶段：前端业务页面（已完成）

目标：双端 H5/PC 页面，对接 HTTP 接口与 WebSocket 实时推送。

| 模块 | 状态 | 说明 |
|---|---|---|
| 路由 | ✅ | `react-router-dom` 5 个路由 |
| Tailwind CSS | ✅ | v4 + `@tailwindcss/vite`，零配置 |
| axios 客户端 | ✅ | `src/api/client.ts`，统一 baseURL |
| WebSocket 客户端 | ✅ | `src/lib/ws.ts`，5 次自动重连，间隔 3s |
| user_id | ✅ | localStorage 持久化随机 ID |
| 公共组件 | ✅ | `StatusBadge`、`Countdown`（最后 30s 变红） |
| 商家列表 `/admin` | ✅ | 表格 + 按状态显示开始/取消按钮 |
| 商家创建 `/admin/create` | ✅ | 表单 + 错误显示 + 跳转回列表 |
| 用户大厅 `/` | ✅ | H5 卡片，过滤 active/pending |
| 详情页 `/auction/:id` | ✅ | 实时刷新最高价/排行/倒计时；超越提示；结束页 |
| 订单页 `/auction/:id/order` | ✅ | 模拟支付按钮 |
| 生产构建 | ✅ | `npm run build` 通过，295KB JS / 22KB CSS |

**重点：详情页的 WebSocket 行为**

| WS 事件 | 页面反应 |
|---|---|
| `auction_started` | 状态变 active，开始倒计时 |
| `new_bid` | 最高价数字黄色闪烁 + 排行刷新 + 倒计时同步；若我是 winner → 绿条「你正在领先」；若我曾出价但被超越 → 黄条「你被超越了」 |
| `auction_finished` | 切换到结束页；赢家看到 🏆 + 「查看订单」按钮 |
| `auction_cancelled` | 切换到 🚫 取消页 |
| 断线 | 顶部显示「正在重连…」，5 次后才彻底放弃 |

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
{"type":"auction_started","auction_id":1,"ends_at":"...","server_time":"..."}

// 新出价（每次出价后广播）
{"type":"new_bid","auction_id":1,"current_price":130,"winner_id":2,
 "ends_at":"...","participant_count":23,"auto_extended":true,
 "auto_extend_seconds":20,"server_time":"...",
 "top_bids":[{"user_id":2,"amount":130},...]}

// 竞拍结束（封顶价命中 或 定时器到期触发）
{"type":"auction_finished","auction_id":1,"final_price":150,"winner_id":3,"server_time":"..."}

// 竞拍取消
{"type":"auction_cancelled","auction_id":1,"server_time":"..."}
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
| 数据模型 | ✅ | User / Merchant / Auction / Bid / Order / Comment |
| 竞拍接口 | ✅ | 创建 / 列表 / 详情 / 开始 / 取消，5 个接口 |
| 出价接口 | ✅ | 出价（含加价/封顶/自动延时校验）+ Top10 排行榜 |
| 订单接口 | ✅ | 按 auction_id 查订单；需登录且校验可见权限 |
| 定时任务 | ✅ | `config/scheduler.go` 每 5s 扫描过期 active 竞拍，自动 finished 并生成订单 |
| CORS | ✅ | 由 `ALLOWED_ORIGINS` 配置，release 模式必须显式设置 |
| E2E 测试 | ✅ | curl 全流程跑通：创建→开始→出价→封顶/超时→查订单 |

**已注册路由清单**

```
GET    /health
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auctions
GET    /api/auctions/:id
GET    /api/auctions/:id/bids
GET    /api/auctions/:id/stats
GET    /api/auctions/:id/comments
GET    /ws/auctions/:id

# 以下接口需要 Authorization: Bearer <token>
GET    /api/auth/me
POST   /api/auctions
PUT    /api/auctions/:id
POST   /api/auctions/:id/start
POST   /api/auctions/:id/cancel
POST   /api/auctions/:id/bids
POST   /api/auctions/:id/comments
POST   /api/auctions/:id/events
GET    /api/auctions/:id/order
GET    /api/me/bids
GET    /api/me/orders
GET    /api/admin/merchants
POST   /api/admin/merchants
DELETE /api/admin/merchants/:user_id
GET    /api/admin/metrics
GET    /api/admin/alerts
GET    /api/admin/orders
POST   /api/admin/uploads/images
```

**业务规则要点**

- 所有成功响应 `{"data": ...}`，失败响应 `{"error": "原因"}`
- 出价校验顺序：状态 → 是否过期 → 加价幅度 → 封顶价
- 0 元起拍：`start_price_cents` 可为 0；首次出价必须高于当前价并满足加价幅度
- 加价规则：`amount_cents = current_price_cents + n × price_step_cents` (n ≥ 1)
- 自动延时：`auto_extend_seconds` 只允许 10-30 秒；距 `ends_at` 不足该秒数时出价会延后结束时间
- 封顶价命中：立即 finished + 生成订单
- 出价幂等：前端每次点击生成 `client_bid_id`；后端通过唯一索引避免同一点击重复落库
- 出价限流：同一用户同一竞拍 700ms 内不同 `client_bid_id` 的重复出价返回 429
- 并发控制：Redis 可用时先抢单场竞拍短 TTL 出价锁，再进入 MySQL 事务 + `SELECT ... FOR UPDATE`
- 读写分离：列表/详情/统计走 Redis 短 TTL 读缓存，创建/编辑/开始/取消/出价后清理缓存，写入仍以 MySQL 为准
- 定时器幂等：用条件更新避免与封顶价路径重复生成订单
- 订单表 `auction_id` 加唯一索引，双保险

### ⏳ 后续阶段（待真实服务器信息）

- 替换真实域名、生产密码和 HTTPS 证书后，在你的服务器执行部署。

---

## 📁 项目结构

```
auction-system/
├── README.md                  # 你正在看的文件
├── docker-compose.yml         # 一键启动 MySQL + Redis
├── docs/
│   ├── demo.md                # 3-5 分钟演示闭环脚本
│   ├── design.md              # 架构、状态机、并发和权限方案
│   ├── ai-usage.md            # AI 使用流程和人工把控边界
│   ├── performance.md         # 压测方法、结果模板和一致性检查 SQL
│   └── deployment.md          # 生产服务器部署说明
├── deploy/
│   ├── docker-compose.prod.yml # 生产 Docker Compose 编排
│   ├── nginx.conf              # HTTPS / API / WS 反向代理模板
│   └── .env.prod.example       # 生产环境变量模板
│
├── backend/                   # Go 后端
│   ├── Dockerfile              # 后端生产镜像
│   ├── go.mod / go.sum        # Go 依赖清单
│   ├── .env                   # 真实配置（不要提交 git）
│   ├── .env.example           # 配置模板（可提交）
│   ├── .gitignore
│   ├── cmd/server/main.go     # 程序入口（启动时初始化 DB + 定时器）
│   ├── config/
│   │   ├── config.go          # 加载 .env 配置
│   │   ├── db.go              # GORM 连 MySQL + AutoMigrate
│   │   ├── redis.go           # Redis 客户端 + 出价短锁
│   │   ├── cache.go           # Redis JSON 短 TTL 读缓存
│   │   └── scheduler.go       # 5s 定时扫描过期竞拍
│   ├── controllers/           # 接口处理函数
│   │   ├── health_controller.go
│   │   ├── auth.go            # 注册 / 登录 / 当前用户
│   │   ├── auction.go         # 竞拍 CRUD + 开始/取消（含 WS 广播）
│   │   ├── bid.go             # 出价 + Top10 排行（含 WS 广播）
│   │   ├── admin_metrics.go   # 管理员轻量监控指标
│   │   ├── order.go           # 查询订单 + 内部 createOrder
│   │   └── ws.go              # WebSocket 升级 + 心跳泵
│   ├── middleware/
│   │   └── auth.go            # JWT 签发 + 验证中间件
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
    ├── Dockerfile              # 前端生产镜像
    ├── nginx.default.conf      # 前端容器内静态资源 Nginx 配置
    ├── package.json
    ├── .env                   # VITE_API_BASE 指向后端
    ├── vite.config.ts         # 含 @tailwindcss/vite 插件
    └── src/
        ├── main.tsx
        ├── App.tsx            # BrowserRouter 路由表
        ├── index.css          # Tailwind 入口 + flash 动画
        ├── api/client.ts      # axios + ws URL 生成 + JWT 拦截器
        ├── lib/
        │   ├── types.ts       # Auction/Bid/Order/WSMessage 类型
        │   ├── auth.ts        # token / user 存 localStorage
        │   └── ws.ts          # AuctionWS：5 次自动重连
        ├── components/
        │   ├── StatusBadge.tsx
        │   ├── Countdown.tsx
        │   ├── RequireAuth.tsx    # 未登录跳 /login 的路由守卫
        │   ├── PhoneFrame.tsx     # 桌面端把用户端套进 iPhone 边框
        │   ├── BottomNav.tsx      # 用户端底部 Tab：🏠 大厅 / 👤 我的
        │   ├── AdminLayout.tsx    # 商家端：左栏 + 内容区
        │   └── AdminSidebar.tsx   # 商家端左侧导航
        └── pages/
            ├── UserHall.tsx           # /         大厅（大标题 + pill 过滤 + 卡片）
            ├── Me.tsx                 # /me       我的（含商家入口）
            ├── Login.tsx              # /login    登录 / 注册
            ├── AuctionDetail.tsx      # /auction/:id        用户端实时详情
            ├── OrderPage.tsx          # /auction/:id/order  订单
            ├── AdminList.tsx          # /admin              商家竞拍管理表格
            ├── AdminAuctionDetail.tsx # /admin/auctions/:id 商家端商品详情
            └── AdminCreate.tsx        # /admin/create       发布竞拍
```

---

## 🗂️ 数据模型

数据库 `auction` 共 6 张表，GORM 启动时 AutoMigrate 自动建好。所有主键 `bigint unsigned`，金额核心字段使用整数分（`*_cents`），旧的元字段保留用于前端兼容，时间 `datetime(3)`（毫秒精度）。

### `auctions`（竞拍主表）

> 命名说明：原任务描述中称为"商品表 `auction_items`"，本项目把"商品"和"竞拍场次"合并到一张表（小项目惯例），表名保留 `auctions`。后续若出现"同一商品多次开拍"再拆表。

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | 主键 |
| `seller_user_id` | bigint unsigned | IDX | 创建该竞拍的商家用户 |
| `title` | varchar(255) | — | 商品标题 |
| `description` | text | — | 商品描述 |
| `image_url` | varchar(512) | — | 主图 URL |
| `start_price_cents` | bigint | — | 起拍价（分） |
| `price_step_cents` | bigint | — | 加价幅度（分） |
| `ceiling_price_cents` | bigint | — | 封顶价（分，可空） |
| `current_price_cents` | bigint | — | 当前价（分） |
| `start_price`/`price_step`/`ceiling_price`/`current_price` | decimal(12,2) | — | 兼容旧前端的元字段 |
| `duration_seconds` | bigint | — | 持续秒数 |
| `auto_extend_seconds` | bigint | — | 自动延时秒数，默认 30 |
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
| `amount_cents` | bigint | — | 出价金额（分） |
| `amount` | decimal(12,2) | — | 兼容旧前端的元字段 |
| `client_bid_id` | varchar(64) | UNIQUE(`auction_id`,`user_id`,`client_bid_id`) | 前端点击级幂等键，可空 |
| `created_at` | datetime(3) | — | 出价时间 |

### `orders`（订单表）

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | |
| `auction_id` | bigint unsigned | **UNIQUE** | 一场拍卖最多一个订单 |
| `user_id` | bigint unsigned | IDX | 中标用户 |
| `final_price_cents` | bigint | — | 成交价（分） |
| `final_price` | decimal(12,2) | — | 兼容旧前端的元字段 |
| `status` | varchar(16) | — | 默认 pending（后续可扩 paid/shipped） |
| `created_at`/`updated_at` | datetime(3) | — | 时间戳 |

### `comments`（直播评论表）

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | |
| `auction_id` | bigint unsigned | IDX | 哪场竞拍 |
| `user_id` | bigint unsigned | IDX | 评论用户 |
| `username` | varchar(64) | — | 评论时用户名快照 |
| `content` | varchar(300) | — | 评论内容 |
| `created_at` | datetime(3) | IDX | 评论时间 |

### `merchants`（商家表）

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | |
| `user_id` | bigint unsigned | UNIQUE | 对应用户 |
| `display_name` | varchar(64) | — | 商家展示名 |
| `status` | varchar(16) | IDX | active / disabled |
| `created_at`/`updated_at` | datetime(3) | — | 时间戳 |

### `users`（用户表）

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | |
| `username` | varchar(64) | UNIQUE | 用户名，2–32 字符 |
| `password_hash` | varchar(128) | — | bcrypt 哈希，JSON 序列化时被 `json:"-"` 隐藏 |
| `created_at`/`updated_at` | datetime(3) | — | |

> 注册 / 登录 / JWT 鉴权由 `controllers/auth.go` + `middleware/auth.go` 提供。

### `user_events`（用户行为埋点）

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | bigint unsigned | PK | |
| `auction_id` | bigint unsigned | IDX | 哪场竞拍 |
| `user_id` | bigint unsigned | IDX | 行为发生的用户 |
| `event_type` | varchar(64) | IDX | 例如 `enter_room` / `click_bid_chip` / `leave_room` |
| `metadata` | text | — | 自定义 JSON 字符串（≤ 2000 字符） |
| `user_agent` | varchar(255) | — | 自动采集，截断到 255 字符 |
| `created_at` | datetime(3) | — | 上报时间 |

> 由 `POST /api/auctions/:id/events` 写入；管理端 `metrics.total_events_today` 暴露今日采集总量。

### 状态机

```
pending(未开始) ──/start──→ active(进行中) ──自然到期/触达封顶──→ finished(已结束)
       │                          │
       └────/cancel────→ cancelled(已取消) ←────/cancel────┘
```

- pending：只能 start 或 cancel
- active：可出价、可 cancel；定时器扫描 `ends_at`；触达 `ceiling_price` 立即结束
- finished / cancelled：只读，不可逆
- 创建 / 开始 / 取消竞拍：需要商家或管理员权限
- 查询订单：需要登录，且只能由中标用户、竞拍商家或管理员查看

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

JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRE_HOURS=72
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ADMIN_USERNAMES=admin
MAX_BID_AMOUNT_CENTS=100000000
WS_MAX_CONNECTIONS=1000
```

> `SERVER_MODE=release` 时必须显式配置 `JWT_SECRET` 和 `ALLOWED_ORIGINS`，且 `ALLOWED_ORIGINS` 不能为 `*`。
> `MAX_BID_AMOUNT_CENTS` 是系统级单笔出价上限，`WS_MAX_CONNECTIONS` 是单后端进程 WebSocket 最大连接数。

### 超级管理员账号

当前项目约定使用已注册的 `admin` 用户作为开发环境超级管理员：

1. 后端 `.env` 保持 `ADMIN_USERNAMES=admin`
2. 重启后端让配置生效
3. 前端登录 `admin` 账号
4. 访问 `/admin`、`/admin/create`、`/admin/orders` 管理竞拍、商家和订单

超级管理员按 `username` 判断，不依赖固定用户 ID。多个管理员可用英文逗号分隔，例如 `ADMIN_USERNAMES=admin,root,boss`。

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
| `github.com/gorilla/websocket` | WebSocket（实时出价用） |
| `github.com/joho/godotenv` | 读取 `.env` 文件 |
| `github.com/redis/go-redis/v9` | Redis 读缓存、出价短 TTL 分布式锁 |

### 前端依赖

由 `npm create vite@latest --template react-ts` 自动安装：React 19、React-DOM、TypeScript、Vite。

### 高并发与实时同步方案

| 考察点 | 当前实现 |
|---|---|
| 出价一致性 | MySQL 事务内 `SELECT ... FOR UPDATE` 锁定竞拍行，更新当前价、赢家、订单生成在同一事务完成 |
| 出价幂等 | 前端每次点击带 `client_bid_id`，后端 `bids` 表用 `(auction_id,user_id,client_bid_id)` 唯一索引兜底 |
| 分布式锁 | Redis 可用时使用 `SET NX EX` 获取 `auction:bid-lock:{id}`，Lua 校验 value 后释放 |
| 读写分离 | 读路径优先 Redis 短 TTL 缓存；写路径只写 MySQL 并失效缓存 |
| 防缓存击穿 | 高频读接口 TTL 很短（统计 1s，列表/详情 2s），实时状态主要靠 WebSocket 推送 |
| 房间隔离 | WebSocket Hub 按 `auction_id` 分房间，只向对应直播间广播 |
| 连接保护 | `WS_MAX_CONNECTIONS` 限制单后端进程最大 WebSocket 连接数，慢客户端发送缓冲满会被剔除 |
| 断连重连 | 前端 `AuctionWS` 自动重连 5 次，每次间隔 3s；重连成功后用 HTTP 重新拉取详情、统计和评论 |
| 毫秒倒计时 | `new_bid` / `auction_started` 带 `server_time`，前端按服务器时间校准后 100ms 刷新 |
| 防抖节流 | 前端出价按钮有提交态 + 700ms 点击间隔保护，后端同一用户同一竞拍 700ms 兜底限流 |
| 登录保护 | 登录失败 5 次后 1 分钟内返回 429，降低暴力破解风险 |
| 金额保护 | 单笔出价先校验系统级 `MAX_BID_AMOUNT_CENTS`，再校验商品封顶价 |
| 压测证明 | `docs/performance.md` 已记录本地 100 VU、300 VU 和 Redis 降级压测结果 |
| 可观测性 | 健康检查 + `/api/admin/metrics` + 关键路径日志 + 测试覆盖；生产级告警面板属于后续部署阶段 |

### 用户端功能验收

| 功能 | 状态 | 说明 |
|---|---|---|
| 直播间 | ✅ | 支持 HLS 地址；加载失败时使用 `public/live.mp4` 固定演示视频 |
| 竞拍浏览 | ✅ | 大厅展示商品列表、状态、当前价、起拍价、加价幅度、封顶价 |
| 详情规则 | ✅ | 详情页展示当前价、封顶价、出价次数、真实参与人数、实时排行 |
| 出价参与 | ✅ | 登录后手动出价，支持快捷倍数和自定义金额 |
| 关键提醒 | ✅ | 领先、被超越、自动延时、竞拍结束通过 toast / 音效 / 动画反馈 |
| 实时排行 | ✅ | 初始走 `/stats`，后续通过 `new_bid` 同步 Top5 |
| 结果查看 | ✅ | 中标用户可查看订单并模拟支付 |
| 历史记录 | ✅ | `/me/bids` 查看参与历史，`/me/orders` 查看订单历史 |

### AI 工具使用沉淀

本项目把 AI 定位为“执行与审查辅助”，而不是替代关键决策：

1. 先由人确定业务边界：用户端、商家端、规则优先级、上线前安全要求。
2. AI 负责快速扫代码、列风险、补测试、生成样板实现和 README 记录。
3. 关键规则由测试约束：出价并发、0 元起拍、自动延时、幂等、防越权都先落到后端测试。
4. 人工把控关键决策：金额改为分字段、管理员策略、Redis 只作为加速/锁增强而不是唯一一致性来源。
5. AI 代码贡献率不追求越高越好：核心交易链路必须可解释、可测试、可回滚；生成代码需要经过 `go test`、前端构建和人工 diff 审查。

合理贡献率评估：AI 适合承担重复代码、接口串联、测试样例、文档整理；拍卖状态机、权限边界、资金/订单一致性等核心决策应由人工确认后再让 AI 执行。

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

- **2026-06-09** — 补齐上线前安全与压测证据：登录失败限流、WebSocket 最大连接数、系统级出价上限、k6 多用户压测脚本和 100/300 VU 实测结果
- **2026-06-09** — 补齐生产部署准备：后端/前端 Dockerfile、生产 Compose、Nginx HTTPS 反代模板、生产环境变量模板和部署文档
- **2026-06-09** — 补齐评审材料和可证明性：演示脚本、方案文档、AI 使用文档、压测脚本、WebSocket 重连补偿、metrics 接口和后端出价限流
- **2026-06-09** — 补齐用户端竞价体验与高并发重点：0 元起拍、10-30 秒延时、出价幂等、Redis 锁/缓存、毫秒倒计时、实时参与人数和 AI 使用说明
- **2026-06-08** — 补齐商家后台基础工作流：图片上传、未开始竞拍编辑、自定义延时、订单管理页
- **2026-06-08** — 完成第七阶段：后端核心加固，出价事务锁、商家权限、订单保护、金额分字段、生产安全配置和测试覆盖
- **2026-06-08** — 完成直播评论持久化：comments 表、历史评论接口、POST 评论接口、WebSocket `new_comment`
- **2026-06-07** — 完成第六阶段：UI 全面升级，液态玻璃 + 暖色 mesh 背景 + 黄橙 accent 配色
- **2026-06-07** — 完成第五阶段：用户系统（JWT + bcrypt），敏感接口加鉴权，前端 /login 页 + 路由守卫
- **2026-06-07** — 完成第四阶段：前端 5 个页面（商家 2 + 用户 3），Tailwind + react-router-dom + 实时 WebSocket 集成
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
