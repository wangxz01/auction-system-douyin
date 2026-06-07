import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { UserHall } from './pages/UserHall'
import { AuctionDetail } from './pages/AuctionDetail'
import { OrderPage } from './pages/OrderPage'
import { AdminList } from './pages/AdminList'
import { AdminCreate } from './pages/AdminCreate'
import { Login } from './pages/Login'
import { RequireAuth } from './components/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserHall />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auction/:id" element={<AuctionDetail />} />
        <Route
          path="/auction/:id/order"
          element={
            <RequireAuth>
              <OrderPage />
            </RequireAuth>
          }
        />
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
