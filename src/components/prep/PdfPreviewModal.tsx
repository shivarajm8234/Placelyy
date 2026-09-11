import { useEffect, useState } from 'react'

interface Props {
  pdfBytes: Uint8Array | null
  title: string
  isOpen: boolean
  onClose: () => void
}

export function PdfPreviewModal({ pdfBytes, title, isOpen, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!pdfBytes || !isOpen) {
      setBlobUrl(null)
      return
    }

    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [pdfBytes, isOpen])

  if (!isOpen) return null

  const downloadFilename = `${(title || 'preparation-notes').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`

  return (
    <div className="pdf-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pdf-modal__header">
          <div className="pdf-modal__title-group">
            <span className="pdf-modal__tag">PDF View</span>
            <h3>{title || 'Preparation Notes'}</h3>
          </div>
          <div className="pdf-modal__actions">
            {blobUrl && (
              <>
                <a
                  className="btn btn--primary btn--sm"
                  href={blobUrl}
                  download={downloadFilename}
                >
                  Download PDF
                </a>
                <a
                  className="btn btn--ghost btn--sm"
                  href={blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Tab
                </a>
              </>
            )}
            <button
              type="button"
              className="pdf-modal__close"
              onClick={onClose}
              aria-label="Close PDF preview"
            >
              ×
            </button>
          </div>
        </header>
        <div className="pdf-modal__body">
          {blobUrl ? (
            <iframe
              title={`PDF Preview of ${title}`}
              src={blobUrl}
              className="pdf-modal__iframe"
            />
          ) : (
            <div className="pdf-modal__loading">
              <div className="prep-spinner" />
              <p>Generating PDF preview…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
