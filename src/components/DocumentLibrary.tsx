import { useDeferredValue, useMemo, useState } from 'react'
import { DocumentRow } from './DocumentRow'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type DocumentCategory,
  type PlacementDocument,
} from '../types/document'

interface Props {
  documents: PlacementDocument[]
  loading: boolean
  error: string | null
}

const TYPE_FILTERS = ['pdf', 'html', 'txt'] as const

export function DocumentLibrary({ documents, loading, error }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | DocumentCategory>('all')
  const [type, setType] = useState<'all' | (typeof TYPE_FILTERS)[number]>('all')
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return documents.filter((doc) => {
      if (category !== 'all' && doc.category !== category) return false
      if (type !== 'all' && doc.type !== type) return false
      if (!q) return true
      const hay = [doc.title, doc.description, ...doc.tags, doc.relativePath]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [documents, deferredQuery, category, type])

  return (
    <section id="library" className="library" aria-labelledby="library-heading">
      <div className="library__head">
        <div>
          <h2 id="library-heading">Placement library</h2>
          <p>
            Search and open PDF or HTML documents stored in Realtime Database.
          </p>
        </div>
        <p className="library__source" data-source="realtime">
          {documents.length} document{documents.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="library__controls">
        <label className="search">
          <span className="visually-hidden">Search documents</span>
          <input
            type="search"
            placeholder="Search titles, folders, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="filters" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={category === 'all' ? 'is-active' : undefined}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {CATEGORY_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={category === key ? 'is-active' : undefined}
              onClick={() => setCategory(key)}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="filters" role="group" aria-label="Filter by type">
          <button
            type="button"
            className={type === 'all' ? 'is-active' : undefined}
            onClick={() => setType('all')}
          >
            Any type
          </button>
          {TYPE_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              className={type === key ? 'is-active' : undefined}
              onClick={() => setType(key)}
            >
              {key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="library__status">Syncing from Firebase…</p>}
      {error && <p className="library__status library__status--error">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="library__status">
          No documents yet. Go to <a href="/upload">Upload</a> and select your
          local <code>Placements</code> folder.
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <ul className="doc-list">
          {filtered.map((doc, i) => (
            <DocumentRow key={doc.id} document={doc} index={i} />
          ))}
        </ul>
      )}
    </section>
  )
}
