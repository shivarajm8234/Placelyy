import { useEffect, useRef, useState } from 'react'
import { pdfjs } from '../../lib/pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'

interface Props {
  data: ArrayBuffer
  /** How many pages to render immediately before the rest */
  priorityPages?: number
  label?: string
}

export function PdfCanvasViewer({
  data,
  priorityPages = 3,
  label,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Loading pages…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let pdf: PDFDocumentProxy | null = null

    async function renderPage(
      pdfDoc: PDFDocumentProxy,
      pageNum: number,
      container: HTMLDivElement,
    ) {
      const page = await pdfDoc.getPage(pageNum)
      const base = page.getViewport({ scale: 1 })
      const width = container.clientWidth || 720
      const scale = Math.min(1.6, Math.max(0.85, width / base.width))
      const viewport = page.getViewport({ scale })

      const canvas = window.document.createElement('canvas')
      canvas.className = 'pdf-page'
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.setAttribute('data-page', String(pageNum))

      const wrap = window.document.createElement('div')
      wrap.className = 'pdf-page-wrap'
      const tag = window.document.createElement('span')
      tag.className = 'pdf-page-tag'
      tag.textContent = `Page ${pageNum}`
      wrap.append(tag, canvas)
      container.append(wrap)

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
    }

    async function run() {
      setError(null)
      setStatus('Opening PDF…')
      const host = hostRef.current
      if (!host) return
      host.replaceChildren()

      try {
        const task = pdfjs.getDocument({ data: data.slice(0) })
        pdf = await task.promise
        if (cancelled) return

        const total = pdf.numPages
        const first = Math.min(priorityPages, total)
        setStatus(`Showing pages 1–${first} of ${total}…`)

        for (let i = 1; i <= first; i += 1) {
          if (cancelled) return
          await renderPage(pdf, i, host)
        }

        if (first < total) {
          setStatus(`Loading remaining pages (${first + 1}–${total})…`)
          for (let i = first + 1; i <= total; i += 1) {
            if (cancelled) return
            await renderPage(pdf, i, host)
          }
        }

        if (!cancelled) setStatus(`${total} page${total === 1 ? '' : 's'}`)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'PDF render failed')
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      void (pdf as PDFDocumentProxy & { cleanup?: () => void })?.cleanup?.()
    }
  }, [data, priorityPages])

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer__status" aria-live="polite">
        {label ? `${label} · ` : ''}
        {error ? error : status}
      </div>
      {error && <p className="library__status library__status--error">{error}</p>}
      <div className="pdf-viewer__pages" ref={hostRef} />
    </div>
  )
}
