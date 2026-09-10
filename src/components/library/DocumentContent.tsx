import { useEffect, useState } from 'react'
import { loadDocumentProgressive } from '../../lib/documents'
import type { PlacementDocument } from '../../types/document'
import { PdfCanvasViewer } from './PdfCanvasViewer'

interface Props {
  doc: PlacementDocument
}

export function DocumentContent({ doc }: Props) {
  const [previewData, setPreviewData] = useState<ArrayBuffer | null>(null)
  const [fullData, setFullData] = useState<ArrayBuffer | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [stage, setStage] = useState<'loading' | 'preview' | 'full'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let url: string | null = null

    async function run() {
      setStage('loading')
      setError(null)
      setPreviewData(null)
      setFullData(null)
      setBlobUrl(null)

      try {
        if (doc.type === 'pdf') {
          await loadDocumentProgressive(doc, async (next, blob) => {
            if (cancelled) return
            const buf = await blob.arrayBuffer()
            if (cancelled) return
            if (next === 'preview') {
              setPreviewData(buf)
              setStage('preview')
            } else {
              setFullData(buf)
              setStage('full')
            }
          })
        } else {
          await loadDocumentProgressive(doc, (_next, blob) => {
            if (cancelled) return
            if (url) URL.revokeObjectURL(url)
            url = URL.createObjectURL(blob)
            setBlobUrl(url)
            setStage('full')
          })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load document')
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc])

  if (error) {
    return <p className="library__status library__status--error">{error}</p>
  }

  if (doc.type === 'pdf') {
    const data = fullData ?? previewData
    if (!data) {
      return <p className="library__status">Fetching first pages…</p>
    }
    return (
      <PdfCanvasViewer
        key={`${doc.id}-${stage}-${data.byteLength}`}
        data={data}
        priorityPages={3}
        label={stage === 'preview' ? 'Preview (first pages)' : 'Full document'}
      />
    )
  }

  if (!blobUrl) {
    return <p className="library__status">Loading document…</p>
  }

  return <iframe title={doc.title} src={blobUrl} className="viewer__frame pane-frame" />
}
