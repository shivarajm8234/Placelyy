import { get, ref as dbRef, remove, set, update } from 'firebase/database'
import { PDFDocument } from 'pdf-lib'
import { database } from '../firebase'
import type {
  NotebookDocumentData,
  NotebookPageData,
  PaperStyle,
  PlacementDocument,
  UserProfile,
  UserWorkSummary,
} from '../types/document'

const NOTEBOOKS_PATH = 'notebooks'
const DOCS_PATH = 'documents'
const USERS_PATH = 'users'
const USER_WORKS_PATH = 'user_works'
const LOCAL_STORAGE_PREFIX = 'placelyy_notebook_'

export const DEFAULT_PAGE_WIDTH = 800
export const DEFAULT_PAGE_HEIGHT = 1100

export function getUserNotebookId(docId: string, uid?: string): string {
  const safeUid = (uid || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `prep_note_${safeUid}_${safeDocId}`
}

export function createBlankPage(pageNumber = 1, paperStyle: PaperStyle = 'ruled'): NotebookPageData {
  return {
    id: `page-${pageNumber}-${Date.now().toString(36)}`,
    pageNumber,
    paperStyle,
    strokes: [],
    texts: [],
    images: [],
    shapes: [],
  }
}

export function createNewNotebook(
  title = 'Preparation Notes',
  category: PlacementDocument['category'] = 'prep',
  paperStyle: PaperStyle = 'ruled',
  userId?: string,
  userEmail?: string,
  userName?: string,
  docId?: string,
): NotebookDocumentData {
  const id = `notebook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()
  return {
    id,
    title,
    category,
    createdAt: now,
    updatedAt: now,
    paperStyle,
    pages: [createBlankPage(1, paperStyle)],
    userId,
    userEmail,
    userName,
    docId,
  }
}

/**
 * Save notebook both to Firebase Realtime Database and local cache with user attribution
 */
export async function saveNotebook(
  notebook: NotebookDocumentData,
  userInfo?: { uid?: string; email?: string | null; displayName?: string | null; isGuest?: boolean },
): Promise<void> {
  const isGuest =
    userInfo?.isGuest ||
    (typeof window !== 'undefined' && localStorage.getItem('placelyy_guest_mode') === 'true')

  if (isGuest) {
    // Guest mode: strictly do NOT save anything to Firebase or localStorage
    return
  }

  const uid = userInfo?.uid || notebook.userId
  const email = userInfo?.email || notebook.userEmail
  const displayName = userInfo?.displayName || notebook.userName

  const updatedNotebook: NotebookDocumentData = {
    ...notebook,
    userId: uid,
    userEmail: email || undefined,
    userName: displayName || undefined,
    updatedAt: new Date().toISOString(),
  }

  // 1. Save to localStorage for instant recovery
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_PREFIX}${notebook.id}`,
      JSON.stringify(updatedNotebook),
    )
  } catch {
    // ignore quota errors
  }

  // 2. Save structured notebook to Firebase Realtime Database
  try {
    await set(dbRef(database, `${NOTEBOOKS_PATH}/${notebook.id}`), updatedNotebook).catch((err) => {
      console.warn('Could not save to Firebase Realtime DB, saved to local cache:', err)
    })
  } catch (err) {
    console.warn('Could not save to Firebase Realtime DB, saved to local cache:', err)
  }

  // 3. If user is logged in, register in user_works index for Admin dashboard
  if (uid) {
    const workSummary: UserWorkSummary = {
      id: notebook.id,
      title: notebook.title || 'Untitled Note',
      docId: notebook.docId,
      updatedAt: updatedNotebook.updatedAt,
      pageCount: notebook.pages.length,
      userId: uid,
      userEmail: email || undefined,
      userName: displayName || undefined,
    }
    try {
      await set(dbRef(database, `${USER_WORKS_PATH}/${uid}/${notebook.id}`), workSummary).catch(() => {})
    } catch {
      // ignore
    }
  }

  // 4. Register or update in documents index so it shows in Library if standalone
  if (!notebook.id.startsWith('prep_note_')) {
    const docMeta: PlacementDocument = {
      id: notebook.id,
      title: notebook.title || 'Untitled Preparation Note',
      description: `Preparation notebook · ${notebook.pages.length} page${notebook.pages.length === 1 ? '' : 's'}`,
      type: 'notebook',
      category: notebook.category || 'prep',
      mimeType: 'application/json',
      chunkCount: 1,
      pageCount: notebook.pages.length,
      relativePath: `Prep/${notebook.title || 'Note'}.notebook`,
      folder: 'Prep',
      tags: ['prep', 'notebook', 'notes'],
      updatedAt: new Date().toISOString().slice(0, 10),
      uploadedBy: uid,
    }

    try {
      await update(dbRef(database, `${DOCS_PATH}/${notebook.id}`), docMeta).catch(() => {})
    } catch (err) {
      console.warn('Could not update documents index:', err)
    }
  }
}

/**
 * Fetch all registered users for Admin Dashboard
 */
export async function fetchRegisteredUsers(): Promise<UserProfile[]> {
  try {
    const snap = await get(dbRef(database, USERS_PATH))
    if (!snap.exists()) return []
    const raw = snap.val() as Record<string, UserProfile>
    const users = Object.values(raw)

    // Also count works per user
    const worksSnap = await get(dbRef(database, USER_WORKS_PATH))
    const worksRaw = worksSnap.exists()
      ? (worksSnap.val() as Record<string, Record<string, UserWorkSummary>>)
      : {}

    return users.map((u) => ({
      ...u,
      workCount: worksRaw[u.uid] ? Object.keys(worksRaw[u.uid]).length : 0,
    })).sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''))
  } catch (err) {
    console.warn('Failed to fetch registered users:', err)
    return []
  }
}

/**
 * Fetch all notes/works for a specific user
 */
export async function fetchUserWorks(uid: string): Promise<UserWorkSummary[]> {
  try {
    const snap = await get(dbRef(database, `${USER_WORKS_PATH}/${uid}`))
    if (!snap.exists()) return []
    const raw = snap.val() as Record<string, UserWorkSummary>
    return Object.values(raw).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch (err) {
    console.warn('Failed to fetch user works:', err)
    return []
  }
}

/**
 * Load notebook from Firebase Realtime Database with localStorage fallback
 */
export async function loadNotebook(id: string): Promise<NotebookDocumentData | null> {
  // If this is a guest ephemeral note, do not query Firebase Realtime DB
  const isGuestNote = id.startsWith('prep_note_guest_') || (typeof window !== 'undefined' && localStorage.getItem('placelyy_guest_mode') === 'true' && id.startsWith('prep_note_'))
  
  if (!isGuestNote) {
    // 1. Try Firebase first
    try {
      const snap = await get(dbRef(database, `${NOTEBOOKS_PATH}/${id}`))
      if (snap.exists()) {
        const data = snap.val() as NotebookDocumentData
        // normalize pages if empty
        if (!data.pages || data.pages.length === 0) {
          data.pages = [createBlankPage(1, data.paperStyle || 'ruled')]
        }
        // sanitize array fields
        data.pages = data.pages.map((p, idx) => ({
          ...p,
          pageNumber: idx + 1,
          paperStyle: p.paperStyle || data.paperStyle || 'ruled',
          strokes: p.strokes || [],
          texts: p.texts || [],
          images: p.images || [],
          shapes: p.shapes || [],
        }))
        // cache locally
        try {
          localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${id}`, JSON.stringify(data))
        } catch {
          // ignore
        }
        return data
      }
    } catch {
      // Offline or unauthenticated / permission denied: gracefully fallback to local cache
    }
  }

  // 2. Fallback to localStorage
  try {
    const local = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${id}`)
    if (local) {
      return JSON.parse(local) as NotebookDocumentData
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Delete a notebook
 */
export async function deleteNotebook(id: string): Promise<void> {
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${id}`)
  } catch {
    // ignore
  }
  try {
    await remove(dbRef(database, `${NOTEBOOKS_PATH}/${id}`))
    await remove(dbRef(database, `${DOCS_PATH}/${id}`))
  } catch (err) {
    console.warn('Failed to delete notebook from Firebase:', err)
  }
}

/**
 * Draw background paper pattern (ruled lined paper, grid, dotted, or blank) onto canvas context
 */
export function drawPaperBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paperStyle: PaperStyle = 'ruled',
) {
  // White crisp paper background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  if (paperStyle === 'ruled') {
    // Top header margin
    const topMargin = 70
    const lineSpacing = 32
    const leftMarginX = 80

    // Ruled horizontal light blue lines
    ctx.strokeStyle = '#c6daf8'
    ctx.lineWidth = 1

    for (let y = topMargin; y < height - 20; y += lineSpacing) {
      ctx.beginPath()
      ctx.moveTo(10, y)
      ctx.lineTo(width - 10, y)
      ctx.stroke()
    }

    // Left vertical red margin line
    ctx.strokeStyle = '#f87171' // soft red / pink line
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(leftMarginX, 0)
    ctx.lineTo(leftMarginX, height)
    ctx.stroke()
  } else if (paperStyle === 'grid') {
    const gridSize = 24
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 0.75

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  } else if (paperStyle === 'dotted') {
    const dotSpacing = 24
    ctx.fillStyle = '#cbd5e1'
    for (let x = dotSpacing; x < width; x += dotSpacing) {
      for (let y = dotSpacing; y < height; y += dotSpacing) {
        ctx.beginPath()
        ctx.arc(x, y, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

/**
 * Render an entire notebook page to an offscreen HTMLCanvasElement
 */
export async function renderPageToCanvas(
  page: NotebookPageData,
  width = DEFAULT_PAGE_WIDTH,
  height = DEFAULT_PAGE_HEIGHT,
  scale = 2, // High resolution for crisp PDF export and retina display
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.scale(scale, scale)

  // 1. Draw Paper Background
  drawPaperBackground(ctx, width, height, page.paperStyle)

  // 2. Draw Images
  if (page.images && page.images.length > 0) {
    for (const imgData of page.images) {
      try {
        const img = await loadImage(imgData.src)
        ctx.drawImage(img, imgData.x, imgData.y, imgData.width, imgData.height)
      } catch (e) {
        console.warn('Could not load image on export:', e)
      }
    }
  }

  // 3. Draw Shapes
  if (page.shapes && page.shapes.length > 0) {
    for (const shape of page.shapes) {
      ctx.save()
      ctx.strokeStyle = shape.color
      ctx.lineWidth = shape.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillStyle = shape.fillColor
      }

      if (shape.type === 'line') {
        ctx.beginPath()
        ctx.moveTo(shape.startX, shape.startY)
        ctx.lineTo(shape.endX, shape.endY)
        ctx.stroke()
      } else if (shape.type === 'arrow') {
        ctx.beginPath()
        ctx.moveTo(shape.startX, shape.startY)
        ctx.lineTo(shape.endX, shape.endY)
        ctx.stroke()

        // Arrow head
        const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX)
        const headlen = 14
        ctx.beginPath()
        ctx.moveTo(shape.endX, shape.endY)
        ctx.lineTo(
          shape.endX - headlen * Math.cos(angle - Math.PI / 6),
          shape.endY - headlen * Math.sin(angle - Math.PI / 6),
        )
        ctx.moveTo(shape.endX, shape.endY)
        ctx.lineTo(
          shape.endX - headlen * Math.cos(angle + Math.PI / 6),
          shape.endY - headlen * Math.sin(angle + Math.PI / 6),
        )
        ctx.stroke()
      } else if (shape.type === 'rect') {
        const x = Math.min(shape.startX, shape.endX)
        const y = Math.min(shape.startY, shape.endY)
        const w = Math.abs(shape.endX - shape.startX)
        const h = Math.abs(shape.endY - shape.startY)
        if (shape.fillColor && shape.fillColor !== 'transparent') {
          ctx.fillRect(x, y, w, h)
        }
        ctx.strokeRect(x, y, w, h)
      } else if (shape.type === 'circle') {
        const rx = Math.abs(shape.endX - shape.startX) / 2
        const ry = Math.abs(shape.endY - shape.startY) / 2
        const cx = Math.min(shape.startX, shape.endX) + rx
        const cy = Math.min(shape.startY, shape.endY) + ry
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        if (shape.fillColor && shape.fillColor !== 'transparent') {
          ctx.fill()
        }
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  // 4. Draw Freehand Strokes (Pen, Highlighter, Eraser)
  if (page.strokes && page.strokes.length > 0) {
    for (const stroke of page.strokes) {
      if (!stroke.points || stroke.points.length === 0) continue

      ctx.save()
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.38
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.width || 18
        ctx.lineCap = 'square'
        ctx.lineJoin = 'bevel'
      } else if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = stroke.width || 20
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      } else {
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.width || 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }

      ctx.beginPath()
      const pts = stroke.points
      ctx.moveTo(pts[0].x, pts[0].y)

      if (pts.length === 1) {
        ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1)
      } else {
        for (let i = 1; i < pts.length; i++) {
          // quadratic curve for smoother handwriting lines
          const midX = (pts[i - 1].x + pts[i].x) / 2
          const midY = (pts[i - 1].y + pts[i].y) / 2
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY)
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      }

      ctx.stroke()
      ctx.restore()
    }
  }

  // 5. Draw Text annotations
  if (page.texts && page.texts.length > 0) {
    for (const textItem of page.texts) {
      ctx.save()
      const fontStyle = textItem.isItalic ? 'italic ' : ''
      const fontWeight = textItem.isBold ? 'bold ' : 'normal '
      const fontSize = textItem.fontSize || 16
      const fontFamily = textItem.fontFamily || 'Figtree, sans-serif'

      ctx.font = `${fontStyle}${fontWeight}${fontSize}px ${fontFamily}`
      ctx.fillStyle = textItem.color || '#101814'
      ctx.textBaseline = 'top'

      const lines = textItem.text.split('\n')
      const lineHeight = fontSize * 1.3
      lines.forEach((line, index) => {
        ctx.fillText(line, textItem.x, textItem.y + index * lineHeight)
      })
      ctx.restore()
    }
  }

  return canvas
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

/**
 * Generate a PDF Uint8Array from notebook document data
 */
export async function exportNotebookToPdfBytes(
  notebook: NotebookDocumentData,
  progressCallback?: (page: number, total: number) => void,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const total = notebook.pages.length

  for (let i = 0; i < total; i++) {
    const pageData = notebook.pages[i]
    progressCallback?.(i + 1, total)

    const canvas = await renderPageToCanvas(pageData, DEFAULT_PAGE_WIDTH, DEFAULT_PAGE_HEIGHT, 2)
    const pngDataUrl = canvas.toDataURL('image/png')
    const pngImageBytes = await fetch(pngDataUrl).then((res) => res.arrayBuffer())
    const pngImage = await pdfDoc.embedPng(pngImageBytes)

    // Standard PDF page size matching canvas aspect ratio (approx A4 595.28 x 841.89)
    const pdfPage = pdfDoc.addPage([DEFAULT_PAGE_WIDTH * 0.75, DEFAULT_PAGE_HEIGHT * 0.75])
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: DEFAULT_PAGE_WIDTH * 0.75,
      height: DEFAULT_PAGE_HEIGHT * 0.75,
    })
  }

  return pdfDoc.save({ useObjectStreams: false })
}
