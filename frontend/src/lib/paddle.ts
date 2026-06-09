// 号牌（paddle）— 用户在拍卖行的身份。
// user_id 转 4 位填充编号，例如 user_id=5 → "№ 0005"。
// 用法：所有用户端 UI 里"用户身份"的呈现都用 paddleNumberOf 而非 username。
export function paddleNumberOf(userId: number | null | undefined): string {
  if (!userId || userId <= 0) return '№ ----'
  return `№ ${String(userId).padStart(4, '0')}`
}

// 拍品编号—拍品在场刊里的位号。
// auction_id 直接 4 位填充。
export function lotNumberOf(auctionId: number): string {
  return `拍品 ${String(auctionId).padStart(4, '0')}`
}
