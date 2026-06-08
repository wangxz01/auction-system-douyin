import { useNavigate } from 'react-router-dom'
import { clearAuth, getUser } from '../lib/auth'
import { BottomNav } from '../components/BottomNav'

export function Me() {
  const nav = useNavigate()
  const me = getUser()

  const logout = () => {
    clearAuth()
    nav(0)
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-28">
      <div className="px-5 pt-5 pb-3">
        <h1 className="ios-large-title">我的</h1>
      </div>

      {/* 用户卡 */}
      <div className="px-4 mt-2">
        <div className="bg-white rounded-2xl px-5 py-5 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl text-white font-bold shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FFD451 0%, #FF9500 100%)',
              boxShadow: '0 4px 10px rgba(255,149,0,0.25)',
            }}
          >
            {me ? me.username.slice(0, 1).toUpperCase() : '👤'}
          </div>
          <div className="flex-1 min-w-0">
            {me ? (
              <>
                <div className="text-lg font-semibold truncate">{me.username}</div>
                <div className="text-xs text-[#8E8E93] mt-0.5">UID #{me.user_id}</div>
              </>
            ) : (
              <>
                <div className="text-base font-medium text-[#3C3C43]">尚未登录</div>
                <div className="text-xs text-[#8E8E93] mt-0.5">登录后参与竞拍</div>
              </>
            )}
          </div>
          {me ? (
            <button
              onClick={logout}
              className="text-sm text-[#FF3B30] font-medium px-3 py-1.5"
            >
              退出
            </button>
          ) : (
            <button
              onClick={() => nav('/login?from=/me')}
              className="text-sm text-[#FF9500] font-semibold px-3 py-1.5"
            >
              登录
            </button>
          )}
        </div>
      </div>

      {/* 拍卖记录分组 */}
      <div className="ios-section-header mt-6">拍卖</div>
      <div className="ios-list">
        <button
          className="ios-list-item ios-list-item-chevron"
          onClick={() => {
            if (!me) return nav('/login?from=/me/bids')
            nav('/me/bids')
          }}
        >
          <span className="text-xl w-7 text-center">📜</span>
          <span className="flex-1">我的拍卖记录</span>
        </button>
        <button
          className="ios-list-item ios-list-item-chevron"
          onClick={() => {
            if (!me) return nav('/login?from=/me/orders')
            nav('/me/orders')
          }}
        >
          <span className="text-xl w-7 text-center">📋</span>
          <span className="flex-1">我的订单</span>
        </button>
      </div>

      {/* 商家分组 */}
      <div className="ios-section-header mt-6">商家</div>
      <div className="ios-list">
        <button
          className="ios-list-item ios-list-item-chevron"
          onClick={() => {
            if (!me) {
              nav('/login?from=/admin')
              return
            }
            nav('/admin')
          }}
        >
          <span className="text-xl w-7 text-center">🛠️</span>
          <span className="flex-1">商家后台</span>
        </button>
      </div>

      {/* 关于 */}
      <div className="ios-section-header mt-6">关于</div>
      <div className="ios-list">
        <div className="ios-list-item no-icon">
          <span className="flex-1 text-[#8E8E93]">版本</span>
          <span className="text-sm text-[#8E8E93]">v0.7</span>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
