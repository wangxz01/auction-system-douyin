const KEY = 'auction_user_id'

export function getUserId(): number {
  let v = localStorage.getItem(KEY)
  if (!v) {
    v = String(Math.floor(Math.random() * 100000) + 1)
    localStorage.setItem(KEY, v)
  }
  return parseInt(v, 10)
}
