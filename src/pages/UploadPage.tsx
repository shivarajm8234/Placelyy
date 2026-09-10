import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { useAuth } from '../auth/AuthContext'
import {
  isUploadableFile,
  uploadPlacementFile,
  type UploadProgress,
} from '../lib/documents'

function relativeFromFile(file: File): string {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (path && path.length > 0) {
    // Drop leading folder if user selected the Placements root itself
    const parts = path.split('/')
    if (parts[0]?.toLowerCase() === 'placements' && parts.length > 1) {
      return parts.slice(1).join('/')
    }
    return path
  }
  return file.name
}

export function UploadPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<UploadProgress[]>([])
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  const doneCount = useMemo(
    () => items.filter((i) => i.status === 'done').length,
    [items],
  )
  const errorCount = useMemo(
    () => items.filter((i) => i.status === 'error').length,
    [items],
  )

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !user) return

    const files = Array.from(fileList).filter(isUploadableFile)
    if (files.length === 0) {
      setSummary('No PDF, HTML, or TXT files found in that selection.')
      return
    }

    setBusy(true)
    setSummary(null)
    setItems(
      files.map((f) => ({
        fileName: relativeFromFile(f),
        percent: 0,
        status: 'uploading',
      })),
    )

    let ok = 0
    let fail = 0

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]
      const relativePath = relativeFromFile(file)
      try {
        await uploadPlacementFile({
          file,
          relativePath,
          uid: user.uid,
          onProgress: (percent) => {
            setItems((prev) =>
              prev.map((row, idx) =>
                idx === i ? { ...row, percent, status: 'uploading' } : row,
              ),
            )
          },
        })
        ok += 1
        setItems((prev) =>
          prev.map((row, idx) =>
            idx === i ? { ...row, percent: 100, status: 'done' } : row,
          ),
        )
      } catch (e) {
        fail += 1
        const message = e instanceof Error ? e.message : 'Upload failed'
        setItems((prev) =>
          prev.map((row, idx) =>
            idx === i ? { ...row, status: 'error', error: message } : row,
          ),
        )
      }
    }

    setSummary(`Uploaded ${ok} file(s)${fail ? `, ${fail} failed` : ''}.`)
    setBusy(false)
  }

  return (
    <div className="page">
      <SiteHeader />
      <main className="upload">
        <div className="upload__intro">
          <Link to="/#library" className="viewer__back">
            ← Library
          </Link>
          <h1>Upload to Firebase</h1>
          <p>
            Select your local <code>Placements</code> folder (or individual
            files). Only <code>shivarajmani2005@gmail.com</code> can upload.
            Files save in Realtime Database; PDFs store a 3-page preview for
            fast open. Max ~35MB per file.
          </p>
        </div>

        <div className="upload__actions">
          <label className={`btn btn--primary ${busy ? 'is-disabled' : ''}`}>
            Choose folder
            <input
              type="file"
              multiple
              disabled={busy}
              onChange={(e) => void handleFiles(e.target.files)}
              ref={(el) => {
                if (!el) return
                el.setAttribute('webkitdirectory', '')
                el.setAttribute('directory', '')
              }}
              hidden
            />
          </label>
          <label className={`btn btn--ghost ${busy ? 'is-disabled' : ''}`}>
            Choose files
            <input
              type="file"
              accept=".pdf,.html,.htm,.txt,application/pdf,text/html,text/plain"
              multiple
              disabled={busy}
              onChange={(e) => void handleFiles(e.target.files)}
              hidden
            />
          </label>
        </div>

        {summary && <p className="upload__summary">{summary}</p>}

        {items.length > 0 && (
          <ul className="upload__list">
            {items.map((item) => (
              <li key={item.fileName} data-status={item.status}>
                <div className="upload__row">
                  <span className="upload__name">{item.fileName}</span>
                  <span className="upload__pct">
                    {item.status === 'done'
                      ? 'Done'
                      : item.status === 'error'
                        ? 'Error'
                        : `${Math.round(item.percent)}%`}
                  </span>
                </div>
                <div className="upload__bar" aria-hidden>
                  <span style={{ width: `${item.percent}%` }} />
                </div>
                {item.error && <p className="upload__error">{item.error}</p>}
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <p className="upload__footer-status">
            {doneCount} done · {errorCount} errors · {items.length} total
          </p>
        )}
      </main>
    </div>
  )
}
