import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getUserNotebookId } from '../lib/notebooks'
import { SiteHeader } from '../components/SiteHeader'
import { DocumentContent } from '../components/library/DocumentContent'
import { PrepNotebookEditor } from '../components/prep/PrepNotebookEditor'
import { useDocuments } from '../hooks/useDocuments'
import { CATEGORY_LABELS } from '../types/document'

export function ViewerPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { documents, loading, error } = useDocuments()
  const doc = documents.find((d) => d.id === id)

  const [viewMode, setViewMode] = useState<'split' | 'doc' | 'notes'>('split')
  const userNotebookId = doc ? getUserNotebookId(doc.id, user?.uid) : ''

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
              <div className="viewer__actions">
                {doc.type !== 'notebook' && (
                  <div className="doc-pane__view-toggle" role="group">
                    <button
                      type="button"
                      className={`btn btn--sm ${viewMode === 'split' ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => setViewMode('split')}
                    >
                      Split View
                    </button>
                    <button
                      type="button"
                      className={`btn btn--sm ${viewMode === 'doc' ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => setViewMode('doc')}
                    >
                      Doc
                    </button>
                    <button
                      type="button"
                      className={`btn btn--sm ${viewMode === 'notes' ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => setViewMode('notes')}
                    >
                      Notes
                    </button>
                  </div>
                )}
                <Link className="btn btn--ghost btn--sm" to="/library">
                  Workspace
                </Link>
              </div>
            </div>

            <div className="viewer__frame-wrap">
              {doc.type === 'notebook' ? (
                <PrepNotebookEditor initialDocId={doc.id} isEmbeddedPane />
              ) : viewMode === 'split' ? (
                <div className="doc-pane__split-container">
                  <div className="doc-pane__split-half doc-pane__split-half--doc">
                    <DocumentContent doc={doc} />
                  </div>
                  <div className="doc-pane__split-divider" />
                  <div className="doc-pane__split-half doc-pane__split-half--notes">
                    <PrepNotebookEditor
                      key={userNotebookId}
                      initialDocId={userNotebookId}
                      defaultTitle={`${doc.title} - Notes`}
                      isEmbeddedPane
                    />
                  </div>
                </div>
              ) : viewMode === 'doc' ? (
                <DocumentContent doc={doc} />
              ) : (
                <PrepNotebookEditor
                  key={userNotebookId}
                  initialDocId={userNotebookId}
                  defaultTitle={`${doc.title} - Notes`}
                  isEmbeddedPane
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
