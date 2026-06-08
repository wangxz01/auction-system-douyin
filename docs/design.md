# 方案设计文档

## 1. 项目背景

本项目是一个实时直播竞拍系统，目标是覆盖商品上架、规则配置、用户实时出价、动态排行榜、竞拍成交和订单查看的完整业务闭环。技术重点不是普通 CRUD，而是竞拍状态机、并发出价一致性、WebSocket 实时同步和断线后的状态恢复。

## 2. 核心挑战

| 挑战 | 风险 | 当前方案 |
|---|---|---|
| 复杂竞拍规则 | 低价覆盖高价、封顶成交重复生成订单 | MySQL 事务 + 行锁 + 状态机不可逆 |
| 0 元起拍 | 首次出价容易被错误校验拒绝 | 起拍价允许 0，首次出价必须高于当前价且满足加价幅度 |
| 自动延时 | 最后一秒出价导致前端倒计时不一致 | 出价事务内更新 `ends_at`，WebSocket 广播新结束时间 |
| 高并发出价 | 同一竞拍被多个请求同时修改 | Redis 短锁 + `SELECT ... FOR UPDATE` 双层保护 |
| 重复点击 | 一笔出价重复落库或重复扣款 | `client_bid_id` + 唯一索引实现点击级幂等 |
| WebSocket 断线 | 断线期间错过 `new_bid` / `auction_finished` | 重连后通过 HTTP 重新拉取详情和统计 |

## 3. 总体架构

```text
React H5 / PC Admin
  | HTTP: REST API
  | WS: /ws/auctions/:id
  v
Gin Backend
  | MySQL: auction/bid/order/comment/user/merchant
  | Redis: short lock + short TTL read cache
  v
MySQL + Redis
```

HTTP 负责可靠状态读取和写入，WebSocket 负责低延迟广播。WebSocket 不被当作可靠消息队列，任何重连后的最终状态都以 HTTP 查询结果为准。

## 4. 状态机

```text
pending -> active -> finished
   |         |
   v         v
cancelled <-+
```

- `pending`：可编辑、可开始、可取消。
- `active`：可出价、可取消；到期或封顶后结束。
- `finished`：只读，生成订单。
- `cancelled`：只读，不生成订单。

状态转换不可逆，避免订单和竞拍状态反复变动。

## 5. 出价流程

```text
POST /api/auctions/:id/bids
  -> 校验 JWT
  -> 解析 amount_cents / client_bid_id
  -> Redis SET NX 获取竞拍锁
  -> MySQL 事务
  -> SELECT auction FOR UPDATE
  -> 检查 client_bid_id 是否已处理
  -> 校验状态、结束时间、加价幅度、封顶价、限流
  -> 插入 bid
  -> 更新 auction current_price / winner / ends_at / status
  -> 命中封顶则生成唯一订单
  -> 提交事务
  -> 失效 Redis 读缓存
  -> 广播 new_bid / auction_finished
```

Redis 锁是性能和削峰手段，不是唯一一致性来源。即使 Redis 不可用，MySQL 行锁和唯一索引仍然保证核心正确性。

## 6. WebSocket 房间设计

后端 Hub 按 `auction_id` 管理房间，每个直播间只接收本竞拍事件：

- `auction_started`
- `new_bid`
- `auction_finished`
- `auction_cancelled`
- `new_comment`

慢客户端发送缓冲满时会被踢出，避免拖垮整个房间广播。

## 7. 重连补偿

前端 WebSocket 自动重连成功后，会重新请求：

- `GET /api/auctions/:id`
- `GET /api/auctions/:id/stats`
- `GET /api/auctions/:id/comments`

这样即使断线期间错过消息，也能用后端最新状态覆盖本地状态。

## 8. 权限设计

| 能力 | 权限 |
|---|---|
| 查看竞拍列表/详情/评论/排行榜 | 公开 |
| 出价/发评论/查看自己的订单 | 登录用户 |
| 创建/开始/取消/编辑竞拍 | 商家或管理员 |
| 查看全部订单/商家管理/指标接口 | 管理员 |
| 查看竞拍订单 | 中标用户、对应商家或管理员 |

管理员通过 `ADMIN_USERNAMES` 指定，开发环境当前使用 `admin`。

## 9. 可观测性

### 9.1 指标接口

`GET /api/admin/metrics` 返回：

- `active_auctions`：活跃竞拍数
- `active_rooms` / `online_ws_connections`：WebSocket 房间数与在线连接数
- `total_bids_today`：今日出价总数
- `redis_available` / `db_available`：Redis / DB 健康
- `alert_count`：当前活跃告警数（详见下文）

### 9.2 告警接口

`GET /api/admin/alerts` 返回结构化告警列表（仅管理员）：

| code | severity | 触发条件 |
|---|---|---|
| `db_unavailable` | critical | DB ping 200ms 内失败 |
| `redis_unavailable` | warning | Redis ping 200ms 内失败（系统会降级到 MySQL 行锁） |
| `stale_active_auction` | warning | 竞拍 `ends_at` 已过但仍为 `active`，等待 5s 调度器收尾 |
| `ws_capacity_high` | warning | WebSocket 在线连接达到 `WS_MAX_CONNECTIONS` 的 80% |

告警按需实时生成（pull 模式），不入库；商家端可轮询 `/admin/metrics.alert_count` 决定是否展开详情面板。

### 9.3 缓存防击穿

`config/cache.go` 提供 `CacheLoadJSON(key, ttl, dest, loader)`：

- 命中直接返回。
- 未命中走 `singleflight.Group.Do`：同一进程内对相同 key 的并发未命中只执行一次 `loader`，其余 goroutine 等待同一份结果。
- `loader` 内部再次双检 Redis，防止"先后到达的两批请求"在窗口期都执行 DB 查询。
- 适用范围：`/auctions`（列表）、`/auctions/:id`（详情）、`/auctions/:id/stats`（统计）。

单元测试 `TestCacheLoadJSONDedupsConcurrentLoads` 验证：20 个并发 goroutine 触发同一 key 的未命中加载，loader 仅执行 1 次。

> 当前为单实例部署，singleflight 即够用。若未来扩展到多实例，可在 Redis 层加 `SET NX` 锁做分布式去重；现阶段不引入以减少故障面。

### 9.4 后续可扩展

生产环境后续可接 Prometheus / Grafana：将 `/admin/metrics` 转换为 Prometheus 文本格式即可挂载。

## 10. 已验证内容

后端测试覆盖：

- 评论持久化和广播
- 订单权限保护
- 并发出价不覆盖高价
- 0 元起拍
- 自动延时范围
- 出价幂等
- 实时广播元数据
- 商家后台发布/编辑/订单/上传

前端验证：

- `npm run lint`
- `npm run build`

压测脚本和记录模板见 `docs/performance.md`。
