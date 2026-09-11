import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { getUserNotebookId } from '../../lib/notebooks'
import { CATEGORY_LABELS, type PlacementDocument } from '../../types/document'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { DocumentContent } from './DocumentContent'
import { PrepNotebookEditor } from '../prep/PrepNotebookEditor'

interface Props {
  doc: PlacementDocument
}

export function DocumentPane({ doc }: Props) {
  const { user } = useAuth()
  const { activeId, focusDoc, closeDoc } = useWorkspace()
  const active = activeId === doc.id

  // View modes: 'split' (half doc, half notes), 'doc' (doc only), 'notes' (notes only)
  const [viewMode, setViewMode] = useState<'split' | 'doc' | 'notes'>('split')

  const isNotebookDoc = doc.type === 'notebook'
  const userNotebookId = getUserNotebookId(doc.id, user?.uid)

  return (
    <section
      className={`doc-pane ${active ? 'is-active' : ''}`}
      onMouseDown={() => focusDoc(doc.id)}
    >
      <header className="doc-pane__bar">
        <div className="doc-pane__bar-info">
          <h3>{doc.title}</h3>
          <p>
            {doc.type.toUpperCase()} · {CATEGORY_LABELS[doc.category]} · {doc.folder}
            {doc.pageCount ? ` · ${doc.pageCount} pages` : ''}
          </p>
        </div>

        <div className="doc-pane__bar-actions">
          {!isNotebookDoc && (
            <div className="doc-pane__view-toggle" role="group" aria-label="Pane view mode">
              <button
                type="button"
                className={`btn btn--sm ${viewMode === 'split' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setViewMode('split')}
                title="Side by side: document and preparation notes"
              >
                Split View
              </button>
              <button
                type="button"
                className={`btn btn--sm ${viewMode === 'doc' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setViewMode('doc')}
                title="Document only"
              >
                Doc
              </button>
              <button
                type="button"
                className={`btn btn--sm ${viewMode === 'notes' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setViewMode('notes')}
                title="Preparation notes only"
              >
                Notes
              </button>
            </div>
          )}

          <button
            type="button"
            className="doc-pane__close"
            aria-label={`Close ${doc.title}`}
            onClick={() => closeDoc(doc.id)}
          >
            ×
          </button>
        </div>
      </header>

      <div className="doc-pane__body">
        {isNotebookDoc ? (
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
    </section>
  )
}
