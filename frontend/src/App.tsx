import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { UserHall } from './pages/UserHall'
import { Login } from './pages/Login'
import { Me } from './pages/Me'
import { RequireAuth } from './components/RequireAuth'
import { PhoneFrame } from './components/PhoneFrame'
import { AdminLayout } from './components/AdminLayout'

// 直播间 + 订单系列：用户切到这些页面时才下载 hls.js 等重资产
const AuctionDetail = lazy(() =>
  import('./pages/AuctionDetail').then((m) => ({ default: m.AuctionDetail })),
)
const OrderPage = lazy(() =>
  import('./pages/OrderPage').then((m) => ({ default: m.OrderPage })),
)
const MyBids = lazy(() => import('./pages/MyBids').then((m) => ({ default: m.MyBids })))
const MyOrders = lazy(() =>
  import('./pages/MyOrders').then((m) => ({ default: m.MyOrders })),
)

// 商家端：用户端首屏完全不下载商家代码
const AdminList = lazy(() =>
  import('./pages/AdminList').then((m) => ({ default: m.AdminList })),
)
const AdminCreate = lazy(() =>
  import('./pages/AdminCreate').then((m) => ({ default: m.AdminCreate })),
)
const AdminAuctionDetail = lazy(() =>
  import('./pages/AdminAuctionDetail').then((m) => ({ default: m.AdminAuctionDetail })),
)
const AdminOrders = lazy(() =>
  import('./pages/AdminOrders').then((m) => ({ default: m.AdminOrders })),
)

const inPhone = (el: React.ReactNode) => <PhoneFrame>{el}</PhoneFrame>

const inAdmin = (el: React.ReactNode) => (
  <RequireAuth>
    <AdminLayout>{el}</AdminLayout>
  </RequireAuth>
)

function RouteFallback() {
  // 极简占位：不抢色调，让外壳（PhoneFrame / AdminLayout）的背景透过来
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        className="w-9 h-9 rounded-full border-2 border-current border-t-transparent animate-spin opacity-30"
        aria-label="加载中"
      />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* 用户端：移动端设计，桌面端套手机壳 */}
          <Route path="/" element={inPhone(<UserHall />)} />
          <Route path="/me" element={inPhone(<Me />)} />
          <Route
            path="/me/bids"
            element={inPhone(
              <RequireAuth>
                <MyBids />
              </RequireAuth>,
            )}
          />
          <Route
            path="/me/orders"
            element={inPhone(
              <RequireAuth>
                <MyOrders />
              </RequireAuth>,
            )}
          />
          <Route path="/login" element={inPhone(<Login />)} />
          <Route path="/auction/:id" element={inPhone(<AuctionDetail />)} />
          <Route
            path="/auction/:id/order"
            element={inPhone(
              <RequireAuth>
                <OrderPage />
              </RequireAuth>,
            )}
          />

          {/* 商家端：PC 后台，左侧导航 + 内容区 */}
          <Route path="/admin" element={inAdmin(<AdminList />)} />
          <Route path="/admin/create" element={inAdmin(<AdminCreate />)} />
          <Route path="/admin/orders" element={inAdmin(<AdminOrders />)} />
          <Route path="/admin/auctions/:id" element={inAdmin(<AdminAuctionDetail />)} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
