import { Link, useParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { DocumentContent } from '../components/library/DocumentContent'
import { useDocuments } from '../hooks/useDocuments'
import { CATEGORY_LABELS } from '../types/document'

export function ViewerPage() {
  const { id } = useParams<{ id: string }>()
  const { documents, loading, error } = useDocuments()
  const doc = documents.find((d) => d.id === id)

  return (
    <div className="page page--viewer">
      <SiteHeader />
      <main className="viewer">
        {loading && <p className="library__status">Loading document…</p>}
        {error && (
          <p className="library__status library__status--error">{error}</p>
        )}
        {!loading && !doc && (
          <div className="viewer__empty">
            <h1>Document not found</h1>
            <p>That file is not in Realtime Database yet.</p>
            <Link className="btn btn--primary" to="/library">
              Back to library
            </Link>
          </div>
        )}
        {doc && (
          <>
            <div className="viewer__toolbar">
              <div className="viewer__info">
                <Link to="/library" className="viewer__back">
                  ← Library
                </Link>
                <h1>{doc.title}</h1>
                <p>
                  <span data-type={doc.type}>{doc.type.toUpperCase()}</span>
                  <span>·</span>
                  <span>{CATEGORY_LABELS[doc.category]}</span>
                  {doc.updatedAt && (
                    <>
                      <span>·</span>
                      <span>Updated {doc.updatedAt}</span>
                    </>
                  )}
                </p>
              </div>
              <Link className="btn btn--ghost" to="/library">
                Open in workspace
              </Link>
            </div>
            <div className="viewer__frame-wrap">
              <DocumentContent doc={doc} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
