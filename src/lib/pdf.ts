import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const PREVIEW_PAGES = 3

/** Build a small PDF containing only the first N pages for fast first paint. */
export async function buildPdfPreview(
  source: ArrayBuffer,
  pageCount = PREVIEW_PAGES,
): Promise<Uint8Array> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true })
  const preview = await PDFDocument.create()
  const total = src.getPageCount()
  const count = Math.min(pageCount, total)
  if (count <= 0) {
    throw new Error('PDF has no pages')
  }
  const indices = Array.from({ length: count }, (_, i) => i)
  const pages = await preview.copyPages(src, indices)
  for (const page of pages) preview.addPage(page)
  return preview.save({ useObjectStreams: false })
}

export async function getPdfPageCount(data: ArrayBuffer): Promise<number> {
  const task = pdfjs.getDocument({ data: data.slice(0) })
  const pdf = await task.promise
  return pdf.numPages
}

export { pdfjs, PREVIEW_PAGES }
