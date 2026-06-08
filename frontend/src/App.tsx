import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { UserHall } from './pages/UserHall'
import { AuctionDetail } from './pages/AuctionDetail'
import { OrderPage } from './pages/OrderPage'
import { Me } from './pages/Me'
import { AdminList } from './pages/AdminList'
import { AdminCreate } from './pages/AdminCreate'
import { AdminAuctionDetail } from './pages/AdminAuctionDetail'
import { Login } from './pages/Login'
import { RequireAuth } from './components/RequireAuth'
import { PhoneFrame } from './components/PhoneFrame'
import { AdminLayout } from './components/AdminLayout'

const inPhone = (el: React.ReactNode) => <PhoneFrame>{el}</PhoneFrame>

const inAdmin = (el: React.ReactNode) => (
  <RequireAuth>
    <AdminLayout>{el}</AdminLayout>
  </RequireAuth>
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 用户端：移动端设计，桌面端套手机壳 */}
        <Route path="/" element={inPhone(<UserHall />)} />
        <Route path="/me" element={inPhone(<Me />)} />
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
        <Route path="/admin/auctions/:id" element={inAdmin(<AdminAuctionDetail />)} />
      </Routes>
    </BrowserRouter>
  )
}
