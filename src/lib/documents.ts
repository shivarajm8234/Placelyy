import { get, onValue, ref as dbRef, remove, set, update } from 'firebase/database'
import { database } from '../firebase'
import { buildPdfPreview, getPdfPageCount } from './pdf'
import {
  FOLDER_NAMES,
  MAX_UPLOAD_BYTES,
  categoryFromPath,
  folderFromPath,
  mimeFromType,
  pathForFolder,
  slugifyId,
  titleFromFilename,
  typeFromFilename,
  type DocumentCategory,
  type PlacementDocument,
} from '../types/document'

const DOCS_PATH = 'documents'
const FILES_PATH = 'files'
const CHUNK_CHARS = 200_000

function mapRecord(
  id: string,
  data: Record<string, unknown>,
): PlacementDocument | null {
  const chunkCount = Number(data.chunkCount ?? 0)
  if (!chunkCount) return null

  const relativePath = String(data.relativePath ?? '')
  const type =
    data.type === 'pdf' ||
    data.type === 'html' ||
    data.type === 'txt' ||
    data.type === 'other'
      ? data.type
      : typeFromFilename(relativePath || id)

  return {
    id,
    title: String(data.title ?? 'Untitled'),
    description: String(data.description ?? ''),
    type,
    category: (data.category as PlacementDocument['category']) || 'other',
    mimeType: String(data.mimeType ?? mimeFromType(type)),
    chunkCount,
    previewChunkCount:
      typeof data.previewChunkCount === 'number'
        ? data.previewChunkCount
        : undefined,
    pageCount: typeof data.pageCount === 'number' ? data.pageCount : undefined,
    relativePath,
    folder: String(data.folder ?? folderFromPath(relativePath)),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    updatedAt: String(data.updatedAt ?? ''),
    uploadedBy: data.uploadedBy ? String(data.uploadedBy) : undefined,
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : undefined,
  }
}

export function subscribeDocuments(
  onChange: (docs: PlacementDocument[]) => void,
  onError: (message: string) => void,
): () => void {
  const docsRef = dbRef(database, DOCS_PATH)

  return onValue(
    docsRef,
    (snap) => {
      if (!snap.exists()) {
        onChange([])
        return
      }

      const raw = snap.val() as Record<string, Record<string, unknown>>
      const docs = Object.entries(raw)
        .map(([id, value]) => mapRecord(id, value))
        .filter((d): d is PlacementDocument => Boolean(d))
        .sort((a, b) => a.title.localeCompare(b.title))

      onChange(docs)
    },
    (err) => {
      onError(err.message || 'Failed to load documents from Realtime Database')
    },
  )
}

export interface UploadProgress {
  fileName: string
  percent: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode.apply(null, Array.from(slice))
  }
  return btoa(binary)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

function chunkBase64(base64: string): string[] {
  const chunks: string[] = []
  for (let i = 0; i < base64.length; i += CHUNK_CHARS) {
    chunks.push(base64.slice(i, i + CHUNK_CHARS))
  }
  return chunks.length ? chunks : ['']
}

async function writeChunks(
  basePath: string,
  chunks: string[],
  onProgress?: (done: number, total: number) => void,
) {
  for (let i = 0; i < chunks.length; i += 1) {
    await set(dbRef(database, `${basePath}/${i}`), chunks[i])
    onProgress?.(i + 1, chunks.length)
  }
}

async function readChunks(basePath: string, count: number): Promise<string> {
  const parts: string[] = []
  for (let i = 0; i < count; i += 1) {
    const snap = await get(dbRef(database, `${basePath}/${i}`))
    if (!snap.exists()) throw new Error(`Missing chunk ${i}`)
    parts.push(String(snap.val()))
  }
  return parts.join('')
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export async function uploadPlacementFile(options: {
  file: File
  relativePath: string
  uid: string
  onProgress?: (percent: number) => void
}): Promise<PlacementDocument> {
  const { file, relativePath, uid, onProgress } = options

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Too large for free Realtime Database (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB). Skip or compress this file.`,
    )
  }

  const safeRel = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/')
  const category = categoryFromPath(safeRel)
  const type = typeFromFilename(file.name)
  const mimeType = file.type || mimeFromType(type)
  const idBase = slugifyId(`${category}-${file.name}`) || slugifyId(file.name)
  const id = `${idBase}-${Date.now().toString(36)}`
  const folder = folderFromPath(safeRel)

  onProgress?.(4)
  const buffer = await file.arrayBuffer()
  onProgress?.(10)

  let previewChunkCount = 0
  let pageCount: number | undefined

  if (type === 'pdf') {
    try {
      pageCount = await getPdfPageCount(buffer.slice(0))
      const previewBytes = await buildPdfPreview(buffer.slice(0))
      const previewChunks = chunkBase64(bytesToBase64(previewBytes))
      previewChunkCount = previewChunks.length
      await writeChunks(`${FILES_PATH}/${id}/preview`, previewChunks)
      onProgress?.(25)
    } catch {
      previewChunkCount = 0
    }
  }

  const base64 = await fileToBase64(file)
  const chunks = chunkBase64(base64)
  onProgress?.(30)

  await writeChunks(`${FILES_PATH}/${id}/chunks`, chunks, (done, total) => {
    onProgress?.(30 + Math.round((done / total) * 65))
  })

  const updatedAt = new Date().toISOString().slice(0, 10)
  const doc: PlacementDocument = {
    id,
    title: titleFromFilename(file.name),
    description: `From ${safeRel}`,
    type,
    category,
    mimeType,
    chunkCount: chunks.length,
    previewChunkCount: previewChunkCount || undefined,
    pageCount,
    relativePath: safeRel,
    folder,
    tags: [category, type, folder.toLowerCase()],
    updatedAt,
    uploadedBy: uid,
    sizeBytes: file.size,
  }

  await set(dbRef(database, `${DOCS_PATH}/${id}`), doc)
  onProgress?.(100)
  return doc
}

export async function loadDocumentPreviewBlob(
  doc: PlacementDocument,
): Promise<Blob | null> {
  if (!doc.previewChunkCount) return null
  const base64 = await readChunks(
    `${FILES_PATH}/${doc.id}/preview`,
    doc.previewChunkCount,
  )
  return base64ToBlob(base64, 'application/pdf')
}

export async function loadDocumentBlob(doc: PlacementDocument): Promise<Blob> {
  const base64 = await readChunks(
    `${FILES_PATH}/${doc.id}/chunks`,
    doc.chunkCount,
  )
  return base64ToBlob(base64, doc.mimeType)
}

/** Progressive: preview first (pages 1–3), then full file. */
export async function loadDocumentProgressive(
  doc: PlacementDocument,
  onStage: (stage: 'preview' | 'full', blob: Blob) => void,
): Promise<void> {
  if (doc.type === 'pdf' && doc.previewChunkCount) {
    const preview = await loadDocumentPreviewBlob(doc)
    if (preview) onStage('preview', preview)
  }

  const full = await loadDocumentBlob(doc)
  onStage('full', full)
}

export async function moveDocument(
  doc: PlacementDocument,
  category: DocumentCategory,
) {
  const fileName =
    doc.relativePath.split('/').pop() || `${doc.title}.${doc.type}`
  const relativePath = pathForFolder(category, fileName)
  const folder = FOLDER_NAMES[category]

  await update(dbRef(database, `${DOCS_PATH}/${doc.id}`), {
    category,
    folder,
    relativePath,
    tags: [category, doc.type, folder.toLowerCase()],
    updatedAt: new Date().toISOString().slice(0, 10),
    description: `From ${relativePath}`,
  })
}

export async function updateDocumentMeta(
  id: string,
  patch: Partial<
    Pick<PlacementDocument, 'title' | 'description' | 'category' | 'tags'>
  >,
) {
  await update(dbRef(database, `${DOCS_PATH}/${id}`), {
    ...patch,
    updatedAt: new Date().toISOString().slice(0, 10),
  })
}

export async function deleteDocument(doc: PlacementDocument) {
  await remove(dbRef(database, `${FILES_PATH}/${doc.id}`))
  await remove(dbRef(database, `${DOCS_PATH}/${doc.id}`))
}

export function isUploadableFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.pdf') ||
    name.endsWith('.html') ||
    name.endsWith('.htm') ||
    name.endsWith('.txt')
  )
}
