# 压测与稳定性验证

本文件记录压测方法和本地实测结果。不要写未经实际运行验证的数据；每次正式展示前应基于当前机器重新运行并更新结果。

## 工具

推荐使用 k6：

```bash
brew install k6
```

脚本路径：

```bash
docs/performance/k6-bidding.js
```

## 前置条件

1. 启动 MySQL 和 Redis。
2. 启动后端。
3. 创建一个 active 状态的竞拍商品。
4. 准备一个管理员账号，或通过 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 让脚本自动注册和登录管理员。
5. 设置环境变量：

```bash
export API_BASE=http://localhost:8080
export ADMIN_USERNAME=perf-admin
export ADMIN_PASSWORD=password123
export STEP_CENTS=100
```

如果传入 `AUCTION_ID`，脚本会复用已有竞拍；否则脚本会自动创建并启动一场压测竞拍。脚本会为每个 VU 注册独立用户，重试时先读取当前价，再按 `current_price + price_step` 出价。

## 运行命令

100 并发：

```bash
k6 run -e VUS=100 docs/performance/k6-bidding.js
```

300 并发：

```bash
k6 run -e VUS=300 docs/performance/k6-bidding.js
```

Docker 运行方式：

```bash
docker run --rm -v "$PWD:/work" -w /work grafana/k6 run \
  -e API_BASE=http://host.docker.internal:18080 \
  -e ADMIN_USERNAME=perf-admin \
  -e ADMIN_PASSWORD=password123 \
  -e VUS=100 \
  docs/performance/k6-bidding.js
```

## 本地实测结果

运行环境：

- 日期：2026-06-09
- 机器：本地开发机，Docker / OrbStack
- 后端：Go Gin，本地 `debug` 模式
- 数据层：MySQL 8.0 Docker 容器，Redis 7 Docker 容器
- 压测工具：`grafana/k6` Docker 镜像
- 说明：本轮压测商品未触发封顶或到期结束，因此订单数预期为 0；本轮重点验证并发出价时 `auctions.current_price_cents` 与 `MAX(bids.amount_cents)` 一致，不出现低价覆盖高价或重复订单。

| 场景 | 请求数 | 成功数 | 业务失败数 | P95 延迟 | 最终最高价 | 订单数 | 结论 |
|---|---:|---:|---:|---:|---:|---:|---|
| 100 VU 同场出价 | 952 | 100 | 0 | 56.96 ms | ¥100.00 | 0 | 当前价等于最高 bid，100 人全部成功 |
| 300 VU 同场出价 | 6726 | 295 | 5 | 53.65 ms | ¥295.00 | 0 | 当前价等于最高 bid，5 次逻辑出价在重试耗尽后业务失败 |
| Redis 不可用降级 100 VU | 970 | 100 | 0 | 54.94 ms | ¥100.00 | 0 | Redis 连接失败时降级到 MySQL 行锁，结果一致 |

## 一致性检查 SQL

```sql
SELECT id, current_price_cents, winner_id, status
FROM auctions
WHERE id = <auction_id>;

SELECT COUNT(*) AS bid_count,
       COUNT(DISTINCT user_id) AS participant_count,
       MAX(amount_cents) AS max_bid
FROM bids
WHERE auction_id = <auction_id>;

SELECT COUNT(*) AS order_count
FROM orders
WHERE auction_id = <auction_id>;
```

本轮一致性检查：

| auction_id | current_price_cents | bid_count | participant_count | max_bid | order_count |
|---:|---:|---:|---:|---:|---:|
| 266 | 10000 | 100 | 100 | 10000 | 0 |
| 267 | 29500 | 295 | 295 | 29500 | 0 |
| 268 | 10000 | 100 | 100 | 10000 | 0 |

验证目标：

- `auctions.current_price_cents = MAX(bids.amount_cents)`
- `winner_id` 对应最高价出价用户
- 封顶或到期后最多 1 条订单
- 不出现低价覆盖高价
- 重复 `client_bid_id` 不产生多条 bid

## 当前结论口径

可以对外表述为：

```text
系统采用 WebSocket 房间隔离、Redis 短锁、MySQL 行锁和出价幂等键保证实时同步与并发一致性。本地压测已验证 100 VU、300 VU 同场竞拍出价，以及 Redis 不可用时降级到 MySQL 行锁的场景。当前实测未发现低价覆盖高价、排名错乱或重复订单。
```

不要在没有压测结果前宣称“已实测 1000+ 在线用户”。
