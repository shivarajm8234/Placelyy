import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { useAuth } from '../auth/AuthContext'

export function HomePage() {
  const { user, isAdmin } = useAuth()

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
              Open multiple PDFs side by side, jump folders fast, and load the
              first pages before the rest — signed in as{' '}
              {user?.displayName ?? user?.email ?? 'you'}.
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
      <footer className="site-footer">
        <p>Placelyy · Spark free · Auth · Realtime Database · Hosting</p>
      </footer>
    </div>
  )
}
