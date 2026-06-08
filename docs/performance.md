# 压测与稳定性验证

本文件记录压测方法和结果填写模板。不要写未经实际运行验证的数据；每次正式展示前应基于当前机器重新运行并更新结果。

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
4. 准备一个可用 JWT。
5. 设置环境变量：

```bash
export API_BASE=http://localhost:8080
export AUCTION_ID=1
export TOKEN='Bearer <jwt>'
export START_CENTS=0
export STEP_CENTS=100
```

## 运行命令

100 并发：

```bash
k6 run -e VUS=100 -e ITERATIONS=100 docs/performance/k6-bidding.js
```

300 并发：

```bash
k6 run -e VUS=300 -e ITERATIONS=300 docs/performance/k6-bidding.js
```

## 结果记录模板

| 场景 | 请求数 | 成功数 | 业务失败数 | P95 延迟 | 最终最高价 | 订单数 | 结论 |
|---|---:|---:|---:|---:|---:|---:|---|
| 100 并发同场出价 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |
| 300 并发同场出价 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |
| Redis 关闭降级 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |

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

验证目标：

- `auctions.current_price_cents = MAX(bids.amount_cents)`
- `winner_id` 对应最高价出价用户
- 封顶或到期后最多 1 条订单
- 不出现低价覆盖高价
- 重复 `client_bid_id` 不产生多条 bid

## 当前结论口径

可以对外表述为：

```text
系统采用 WebSocket 房间隔离、Redis 短锁、MySQL 行锁和出价幂等键保证实时同步与并发一致性。当前仓库提供可复现压测脚本，正式压测结果以 docs/performance.md 中实际运行记录为准。
```

不要在没有压测结果前宣称“已实测 1000+ 在线用户”。
