import { useParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { PrepNotebookEditor } from '../components/prep/PrepNotebookEditor'

export function PrepStudioPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="page page--prep-studio">
      <SiteHeader />
      <main className="prep-studio-main">
        <PrepNotebookEditor initialDocId={id} />
      </main>
    </div>
  )
}
