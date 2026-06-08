import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { UserHall } from './pages/UserHall'
import { AuctionDetail } from './pages/AuctionDetail'
import { OrderPage } from './pages/OrderPage'
import { Me } from './pages/Me'
import { AdminList } from './pages/AdminList'
import { AdminCreate } from './pages/AdminCreate'
import { Login } from './pages/Login'
import { RequireAuth } from './components/RequireAuth'
import { PhoneFrame } from './components/PhoneFrame'

// 把用户端页面统一包进手机壳里（桌面端显示，移动端透明）
const inPhone = (el: React.ReactNode) => <PhoneFrame>{el}</PhoneFrame>

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

        {/* 商家端：PC 后台，宽屏布局 */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminList />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/create"
          element={
            <RequireAuth>
              <AdminCreate />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
