import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { user, loading, error, signInWithGoogle, continueAsGuest } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/'

  if (!loading && user && !user.isAnonymous) {
    return <Navigate to={from} replace />
  }

  async function handleGoogle() {
    setBusy(true)
    try {
      await signInWithGoogle()
      navigate(from, { replace: true })
    } catch {
      // error surfaced via context
    } finally {
      setBusy(false)
    }
  }

  async function handleGuest() {
    setBusy(true)
    try {
      await continueAsGuest()
      navigate(from, { replace: true })
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
          Sign in with Google to save notes, documents, and preparation history across sessions.
        </p>
        <button
          type="button"
          className="btn btn--primary btn--google"
          onClick={() => void handleGoogle()}
          disabled={busy || loading}
        >
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <div className="login-divider">
          <span>or preview without saving</span>
        </div>

        <button
          type="button"
          className="btn btn--secondary btn--guest"
          onClick={() => void handleGuest()}
          disabled={busy || loading}
        >
          {busy ? 'Entering Guest Mode…' : 'Continue as Guest'}
        </button>
        <p className="login-guest-note">
          Guest mode lets you browse the library, edit in Prep Studio, and export PDFs. <strong>Nothing will be saved</strong> to the database.
        </p>

        {error && <p className="login-page__error">{error}</p>}
      </div>
    </div>
  )
}
