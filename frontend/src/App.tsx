import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { UserHall } from './pages/UserHall'
import { AuctionDetail } from './pages/AuctionDetail'
import { OrderPage } from './pages/OrderPage'
import { AdminList } from './pages/AdminList'
import { AdminCreate } from './pages/AdminCreate'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserHall />} />
        <Route path="/auction/:id" element={<AuctionDetail />} />
        <Route path="/auction/:id/order" element={<OrderPage />} />
        <Route path="/admin" element={<AdminList />} />
        <Route path="/admin/create" element={<AdminCreate />} />
      </Routes>
    </BrowserRouter>
  )
}
