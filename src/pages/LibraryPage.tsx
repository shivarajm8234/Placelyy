import { SiteHeader } from '../components/SiteHeader'
import { FolderSidebar } from '../components/library/FolderSidebar'
import { PaneWorkspace } from '../components/library/PaneWorkspace'
import { useDocuments } from '../hooks/useDocuments'
import { WorkspaceProvider } from '../workspace/WorkspaceContext'
import { useAuth } from '../auth/AuthContext'
import { ADMIN_EMAIL } from '../config/admin'
import { Link } from 'react-router-dom'

function LibraryShell() {
  const { documents, loading, error } = useDocuments()
  const { isAdmin } = useAuth()

  return (
    <div className="page page--library">
      <SiteHeader />
      <div className="library-layout">
        <FolderSidebar documents={documents} loading={loading} error={error} />
        <div className="library-main">
          <div className="library-main__meta">
            <p>
              {isAdmin
                ? `Admin · ${ADMIN_EMAIL} can upload, move, and delete`
                : 'View only · ask admin to upload or move files'}
            </p>
            {isAdmin && (
              <Link className="btn btn--ghost" to="/upload">
                Upload
              </Link>
            )}
          </div>
          <PaneWorkspace documents={documents} />
        </div>
      </div>
    </div>
  )
}

export function LibraryPage() {
  return (
    <WorkspaceProvider>
      <LibraryShell />
    </WorkspaceProvider>
  )
}
