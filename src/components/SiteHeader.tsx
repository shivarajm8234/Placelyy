import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AdminUsersModal } from './admin/AdminUsersModal'

export function SiteHeader() {
  const { user, isGuest, isAdmin, signInWithGoogle, signOut } = useAuth()
  const [isAdminUsersModalOpen, setIsAdminUsersModalOpen] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      await signInWithGoogle()
    } catch {
      // error surfaced via auth context
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          {/* Brand Logo */}
          <Link to="/" className="brand" aria-label="Placelyy home">
            <span className="brand__mark" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </span>
            <span className="brand__text">Placelyy</span>
            <span className="brand__badge">PREP</span>
          </Link>

          {/* Central Navigation Pills */}
          {(user || isGuest) && (
            <nav className="site-nav" aria-label="Primary navigation">
              <div className="site-nav__pills">
                <NavLink
                  to="/library"
                  className={({ isActive }) =>
                    `nav-pill ${isActive ? 'nav-pill--active' : ''}`
                  }
                  title="Document Library & Notes"
                >
                  <svg className="nav-pill__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span>Library</span>
                </NavLink>

                <NavLink
                  to="/prep"
                  className={({ isActive }) =>
                    `nav-pill nav-pill--prep ${isActive ? 'nav-pill--active' : ''}`
                  }
                  title="Prep Studio - Canvas & Notebook Editor"
                >
                  <svg className="nav-pill__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                  <span>Prep Studio</span>
                </NavLink>

                {isAdmin && (
                  <NavLink
                    to="/upload"
                    className={({ isActive }) =>
                      `nav-pill ${isActive ? 'nav-pill--active' : ''}`
                    }
                    title="Upload Documents (Admin)"
                  >
                    <svg className="nav-pill__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Upload</span>
                  </NavLink>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    className="nav-pill nav-pill--action"
                    onClick={() => setIsAdminUsersModalOpen(true)}
                    title="View all registered users and note submissions"
                  >
                    <svg className="nav-pill__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>Users &amp; Works</span>
                  </button>
                )}
              </div>
            </nav>
          )}

          {/* Right Action Container (Guest vs Authenticated) */}
          <div className="site-header__actions">
            {isGuest ? (
              <div className="site-header__guest-group">


                <button
                  type="button"
                  className="nav-cta-btn nav-cta-btn--signin"
                  onClick={() => void handleSignIn()}
                  disabled={isSigningIn}
                  title="Sign in with Google to save notes to cloud"
                >
                  <svg className="nav-cta-btn__icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  <span>{isSigningIn ? 'Signing in…' : 'Sign in'}</span>
                </button>

                <button
                  type="button"
                  className="nav-icon-btn"
                  onClick={() => void signOut()}
                  title="Exit Guest Mode"
                  aria-label="Exit Guest Mode"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="nav-icon-btn__label">Exit</span>
                </button>
              </div>
            ) : user ? (
              <div className="site-header__user-group">
                <div
                  className="nav-user-chip"
                  onClick={() => {
                    if (isAdmin) setIsAdminUsersModalOpen(true)
                  }}
                  title={isAdmin ? 'Administrator account — Click to view works' : (user.displayName || user.email || 'Account')}
                  role={isAdmin ? 'button' : undefined}
                >
                  {user.photoURL ? (
                    <img
                      className="nav-user-chip__avatar"
                      src={user.photoURL}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="nav-user-chip__initials">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="nav-user-chip__name">
                    {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Account'}
                  </span>
                  {isAdmin && <span className="nav-user-chip__admin-badge">ADMIN</span>}
                </div>

                <button
                  type="button"
                  className="nav-icon-btn nav-icon-btn--danger"
                  onClick={() => void signOut()}
                  title="Sign out of Placelyy"
                  aria-label="Sign out"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="nav-icon-btn__label">Sign out</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {isAdmin && (
        <AdminUsersModal
          isOpen={isAdminUsersModalOpen}
          onClose={() => setIsAdminUsersModalOpen(false)}
        />
      )}
    </>
  )
}
