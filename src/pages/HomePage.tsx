import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { useAuth } from '../auth/AuthContext'

export function HomePage() {
  const { user, isGuest, isAdmin } = useAuth()

  return (
    <div className="page">
      <SiteHeader />
      <main>
        <section className="hero" aria-label="Placelyy">
          <div className="hero__atmosphere" aria-hidden />
          <div className="hero__content">
            <p className="hero__eyebrow">Campus placements</p>
            <h1 className="hero__brand">Placelyy</h1>
            <p className="hero__lede">
              Welcome to the Placement Learning System{isGuest ? ' (Guest Mode)' : `, ${user?.displayName ?? user?.email ?? 'there'}`}.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--primary" to="/library">
                Browse library
              </Link>
              {isAdmin ? (
                <Link className="btn btn--ghost" to="/upload">
                  Upload Placements folder
                </Link>
              ) : (
                <span className="hero__hint">View only · admin manages files</span>
              )}
            </div>
          </div>
        </section>
      </main>

    </div>
  )
}
