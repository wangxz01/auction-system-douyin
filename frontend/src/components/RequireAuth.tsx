import { Navigate, useLocation } from 'react-router-dom'
import { isLoggedIn } from '../lib/auth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (!isLoggedIn()) {
    const from = encodeURIComponent(loc.pathname + loc.search)
    return <Navigate to={`/login?from=${from}`} replace />
  }
  return <>{children}</>
}
