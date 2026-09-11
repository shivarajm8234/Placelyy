import { useEffect, useState } from 'react'
import { fetchRegisteredUsers, fetchUserWorks, loadNotebook } from '../../lib/notebooks'
import type { NotebookDocumentData, UserProfile, UserWorkSummary } from '../../types/document'
import { PrepNotebookEditor } from '../prep/PrepNotebookEditor'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function AdminUsersModal({ isOpen, onClose }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [userWorks, setUserWorks] = useState<UserWorkSummary[]>([])
  const [loadingWorks, setLoadingWorks] = useState(false)
  const [inspectingNotebook, setInspectingNotebook] = useState<NotebookDocumentData | null>(null)
  const [loadingNotebook, setLoadingNotebook] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSelectedUser(null)
      setUserWorks([])
      setInspectingNotebook(null)
      return
    }

    async function loadUsers() {
      setLoading(true)
      try {
        const list = await fetchRegisteredUsers()
        setUsers(list)
      } finally {
        setLoading(false)
      }
    }
    void loadUsers()
  }, [isOpen])

  const handleSelectUser = async (u: UserProfile) => {
    setSelectedUser(u)
    setInspectingNotebook(null)
    setLoadingWorks(true)
    try {
      const works = await fetchUserWorks(u.uid)
      setUserWorks(works)
    } finally {
      setLoadingWorks(false)
    }
  }

  const handleInspectWork = async (workId: string) => {
    setLoadingNotebook(true)
    try {
      const nb = await loadNotebook(workId)
      setInspectingNotebook(nb)
    } finally {
      setLoadingNotebook(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__header">
          <div className="admin-modal__title-group">
            <span className="admin-modal__tag">Admin</span>
            <h3>Registered Users &amp; Works</h3>
          </div>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="admin-modal__body">
          {inspectingNotebook ? (
            <div className="admin-modal__inspect-view">
              <div className="admin-modal__inspect-bar">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setInspectingNotebook(null)}
                >
                  &larr; Back to {selectedUser?.displayName || 'User'} works
                </button>
                <span className="admin-modal__inspect-title">
                  {inspectingNotebook.title} ({inspectingNotebook.userName || inspectingNotebook.userEmail || 'User'})
                </span>
              </div>
              <div className="admin-modal__inspect-editor">
                <PrepNotebookEditor
                  initialData={inspectingNotebook}
                  isEmbeddedPane
                />
              </div>
            </div>
          ) : (
            <div className="admin-modal__columns">
              {/* Users List Column */}
              <div className="admin-modal__user-list-col">
                <div className="admin-modal__col-header">
                  <h4>All Users ({users.length})</h4>
                  <p>Click a user to see their notes and works</p>
                </div>

                {loading ? (
                  <p className="admin-modal__status">Loading users…</p>
                ) : users.length === 0 ? (
                  <p className="admin-modal__status">No registered users found in database.</p>
                ) : (
                  <ul className="admin-modal__user-list">
                    {users.map((u) => {
                      const isSelected = selectedUser?.uid === u.uid
                      return (
                        <li key={u.uid}>
                          <button
                            type="button"
                            className={`admin-user-card ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => void handleSelectUser(u)}
                          >
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt=""
                                className="admin-user-card__avatar"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="admin-user-card__avatar-fallback">
                                {(u.displayName || u.email || 'U')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="admin-user-card__info">
                              <span className="admin-user-card__name">
                                {u.displayName || 'Unnamed User'}
                              </span>
                              <span className="admin-user-card__email">{u.email}</span>
                              <div className="admin-user-card__meta">
                                <span>{u.workCount || 0} note(s)</span>
                                {u.lastActive && (
                                  <span>
                                    Active {new Date(u.lastActive).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* User Works Column */}
              <div className="admin-modal__works-col">
                {selectedUser ? (
                  <>
                    <div className="admin-modal__col-header">
                      <h4>
                        Works by {selectedUser.displayName || selectedUser.email}
                      </h4>
                      <p>
                        {userWorks.length} preparation notebook(s) saved
                      </p>
                    </div>

                    {loadingWorks ? (
                      <p className="admin-modal__status">Loading user works…</p>
                    ) : userWorks.length === 0 ? (
                      <div className="admin-modal__empty-works">
                        <p>This user has not created any preparation notes yet.</p>
                      </div>
                    ) : (
                      <ul className="admin-modal__works-list">
                        {userWorks.map((work) => (
                          <li key={work.id} className="admin-work-card">
                            <div className="admin-work-card__content">
                              <h5>{work.title}</h5>
                              <p className="admin-work-card__meta">
                                <span>{work.pageCount} page(s)</span>
                                <span>·</span>
                                <span>
                                  Updated {new Date(work.updatedAt).toLocaleDateString()}
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={() => void handleInspectWork(work.id)}
                              disabled={loadingNotebook}
                            >
                              View Notes
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="admin-modal__placeholder">
                    <p>Select a user from the left column to view their preparation notes and works.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
