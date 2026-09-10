import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth()

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand" aria-label="Placelyy home">
          <span className="brand__mark" aria-hidden />
          Placelyy
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {user && (
            <>
              <Link to="/library">Library</Link>
              {isAdmin && <Link to="/upload">Upload</Link>}
              <button type="button" className="nav-btn" onClick={() => void signOut()}>
                Sign out
              </button>
              {user.photoURL ? (
                <img
                  className="nav-avatar"
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="nav-user">{user.displayName ?? 'Account'}</span>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
