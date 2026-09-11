import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { deleteDocument, moveDocument } from '../../lib/documents'
import { createNewNotebook, saveNotebook } from '../../lib/notebooks'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type DocumentCategory,
  type PlacementDocument,
} from '../../types/document'
import { useWorkspace } from '../../workspace/WorkspaceContext'

interface Props {
  documents: PlacementDocument[]
  loading: boolean
  error: string | null
}

export function FolderSidebar({ documents, loading, error }: Props) {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { openIds, activeId, openDoc } = useWorkspace()
  const [folder, setFolder] = useState<'all' | DocumentCategory>('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creatingNotebook, setCreatingNotebook] = useState(false)

  async function handleCreatePrepNotebook() {
    setCreatingNotebook(true)
    try {
      const defaultTitle = `Prep Note ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      const title = prompt('Enter notebook title:', defaultTitle)
      if (!title) {
        setCreatingNotebook(false)
        return
      }
      const newNb = createNewNotebook(
        title,
        'prep',
        'ruled',
        user?.uid,
        user?.email || undefined,
        user?.displayName || undefined,
      )
      await saveNotebook(newNb, {
        uid: user?.uid,
        email: user?.email,
        displayName: user?.displayName,
      })
      openDoc(newNb.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not create notebook')
    } finally {
      setCreatingNotebook(false)
    }
  }

  const counts = useMemo(() => {
    const map = Object.fromEntries(
      CATEGORY_ORDER.map((c) => [c, 0]),
    ) as Record<DocumentCategory, number>
    for (const doc of documents) map[doc.category] += 1
    return map
  }, [documents])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents.filter((doc) => {
      if (folder !== 'all' && doc.category !== folder) return false
      if (!q) return true
      return [doc.title, doc.folder, doc.relativePath, ...doc.tags]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [documents, folder, query])

  async function onMove(doc: PlacementDocument, category: DocumentCategory) {
    if (!isAdmin || category === doc.category) return
    setBusyId(doc.id)
    try {
      await moveDocument(doc, category)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Move failed')
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(doc: PlacementDocument) {
    if (!isAdmin) return
    if (!confirm(`Delete “${doc.title}”?`)) return
    setBusyId(doc.id)
    try {
      await deleteDocument(doc)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <aside className="lib-sidebar">
      <div className="lib-sidebar__head">
        <h2>Library</h2>
        <p>Open up to 3 docs · resize panes</p>
      </div>

      <label className="search search--compact">
        <span className="visually-hidden">Search</span>
        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="folder-list" role="tablist" aria-label="Folders">
        <button
          type="button"
          className={folder === 'all' ? 'is-active' : undefined}
          onClick={() => setFolder('all')}
        >
          All <span>{documents.length}</span>
        </button>
        {CATEGORY_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={folder === key ? 'is-active' : undefined}
            onClick={() => setFolder(key)}
          >
            {CATEGORY_LABELS[key]} <span>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="lib-sidebar__quick-prep">
        <button
          type="button"
          className="btn btn--primary btn--sm lib-sidebar__prep-btn"
          onClick={() => void handleCreatePrepNotebook()}
          disabled={creatingNotebook}
          title="Create a new interactive lined notebook"
        >
          {creatingNotebook ? 'Creating…' : '+ New Note'}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm lib-sidebar__prep-btn"
          onClick={() => navigate('/prep')}
          title="Open full-screen digital notebook studio"
        >
          Open Studio
        </button>
      </div>

      {loading && <p className="library__status">Syncing…</p>}
      {error && <p className="library__status library__status--error">{error}</p>}

      <ul className="doc-mini-list">
        {filtered.map((doc) => {
          const open = openIds.includes(doc.id)
          const active = activeId === doc.id
          return (
            <li key={doc.id} className={active ? 'is-active' : open ? 'is-open' : undefined}>
              <button
                type="button"
                className="doc-mini"
                onClick={() => openDoc(doc.id)}
              >
                <span className="doc-mini__type" data-type={doc.type}>
                  {doc.type.toUpperCase()}
                </span>
                <span className="doc-mini__title">{doc.title}</span>
                <span className="doc-mini__folder">{doc.folder}</span>
              </button>

              {isAdmin && (
                <div className="doc-mini__admin">
                  <label>
                    <span className="visually-hidden">Move folder</span>
                    <select
                      value={doc.category}
                      disabled={busyId === doc.id}
                      onChange={(e) =>
                        void onMove(doc, e.target.value as DocumentCategory)
                      }
                    >
                      {CATEGORY_ORDER.map((key) => (
                        <option key={key} value={key}>
                          Move → {CATEGORY_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="nav-btn"
                    disabled={busyId === doc.id}
                    onClick={() => void onDelete(doc)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {!loading && filtered.length === 0 && (
        <p className="library__status">No documents in this folder.</p>
      )}
    </aside>
  )
}
