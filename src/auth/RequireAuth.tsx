import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isGuest, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="auth-gate">
        <p>Checking session…</p>
      </div>
    )
  }

  if (!user && !isGuest) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
