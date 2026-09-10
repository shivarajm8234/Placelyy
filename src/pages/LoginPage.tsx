import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { user, loading, error, signInWithGoogle } = useAuth()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/'

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  async function handleGoogle() {
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch {
      // error surfaced via context
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <Link to="/" className="brand brand--login">
          <span className="brand__mark" aria-hidden />
          Placelyy
        </Link>
        <h1>Sign in to open your placement library</h1>
        <p>
          Documents are stored in Firebase Realtime Database on the free Spark
          plan. Sign in with Google to continue.
        </p>
        <button
          type="button"
          className="btn btn--primary btn--google"
          onClick={() => void handleGoogle()}
          disabled={busy || loading}
        >
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {error && <p className="login-page__error">{error}</p>}
      </div>
    </div>
  )
}
