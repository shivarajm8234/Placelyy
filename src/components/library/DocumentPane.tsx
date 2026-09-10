import { CATEGORY_LABELS, type PlacementDocument } from '../../types/document'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { DocumentContent } from './DocumentContent'

interface Props {
  doc: PlacementDocument
}

export function DocumentPane({ doc }: Props) {
  const { activeId, focusDoc, closeDoc } = useWorkspace()
  const active = activeId === doc.id

  return (
    <section
      className={`doc-pane ${active ? 'is-active' : ''}`}
      onMouseDown={() => focusDoc(doc.id)}
    >
      <header className="doc-pane__bar">
        <div>
          <h3>{doc.title}</h3>
          <p>
            {doc.type.toUpperCase()} · {CATEGORY_LABELS[doc.category]} ·{' '}
            {doc.folder}
            {doc.pageCount ? ` · ${doc.pageCount} pages` : ''}
          </p>
        </div>
        <button
          type="button"
          className="doc-pane__close"
          aria-label={`Close ${doc.title}`}
          onClick={() => closeDoc(doc.id)}
        >
          ×
        </button>
      </header>
      <div className="doc-pane__body">
        <DocumentContent doc={doc} />
      </div>
    </section>
  )
}
