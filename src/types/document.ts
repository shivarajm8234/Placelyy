export type DocumentType = 'pdf' | 'html' | 'txt' | 'notebook' | 'other'

export type PaperStyle = 'ruled' | 'grid' | 'dotted' | 'blank'

export interface NotebookPoint {
  x: number
  y: number
  pressure?: number
}

export interface NotebookStroke {
  id: string
  tool: 'pen' | 'highlighter' | 'eraser'
  color: string
  width: number
  points: NotebookPoint[]
}

export interface NotebookText {
  id: string
  x: number
  y: number
  text: string
  color: string
  fontSize: number
  fontFamily: string
  isBold?: boolean
  isItalic?: boolean
  width?: number
}

export interface NotebookImage {
  id: string
  x: number
  y: number
  width: number
  height: number
  src: string // data URL / image source
}

export interface NotebookShape {
  id: string
  type: 'rect' | 'circle' | 'line' | 'arrow'
  startX: number
  startY: number
  endX: number
  endY: number
  color: string
  width: number
  fillColor?: string
}

export interface NotebookPageData {
  id: string
  pageNumber: number
  paperStyle: PaperStyle
  strokes: NotebookStroke[]
  texts: NotebookText[]
  images: NotebookImage[]
  shapes: NotebookShape[]
}

export interface NotebookDocumentData {
  id: string
  title: string
  category: DocumentCategory
  createdAt: string
  updatedAt: string
  paperStyle: PaperStyle
  pages: NotebookPageData[]
  userId?: string
  userEmail?: string
  userName?: string
  docId?: string
}

export interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  lastActive: string
  workCount?: number
}

export interface UserWorkSummary {
  id: string
  title: string
  docId?: string
  updatedAt: string
  pageCount: number
  userId: string
  userEmail?: string
  userName?: string
}

export type DocumentCategory =
  | 'ai'
  | 'cn'
  | 'dbms'
  | 'ds'
  | 'os'
  | 'sd'
  | 'notes'
  | 'programs'
  | 'prep'
  | 'other'

export interface PlacementDocument {
  id: string
  title: string
  description: string
  type: DocumentType
  category: DocumentCategory
  mimeType: string
  chunkCount: number
  /** Fast first-paint PDF (first 2–3 pages), when available */
  previewChunkCount?: number
  pageCount?: number
  relativePath: string
  folder: string
  tags: string[]
  updatedAt: string
  uploadedBy?: string
  sizeBytes?: number
}

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  ai: 'AI / ML',
  cn: 'Networks',
  dbms: 'DBMS',
  ds: 'DSA',
  os: 'OS',
  sd: 'System Design',
  notes: 'Notes',
  programs: 'Programs',
  prep: 'Prep',
  other: 'Other',
}

export const CATEGORY_ORDER: DocumentCategory[] = [
  'prep',
  'ds',
  'os',
  'cn',
  'dbms',
  'sd',
  'ai',
  'notes',
  'programs',
  'other',
]

export const FOLDER_NAMES: Record<DocumentCategory, string> = {
  ai: 'AI',
  cn: 'CN',
  dbms: 'DBMS',
  ds: 'DS',
  os: 'OS',
  sd: 'SD',
  notes: 'Notes',
  programs: 'Programs',
  prep: 'Prep',
  other: 'Other',
}

/** Spark Realtime Database is ~1GB total — keep uploads bounded. */
export const MAX_UPLOAD_BYTES = 35 * 1024 * 1024

const FOLDER_TO_CATEGORY: Record<string, DocumentCategory> = {
  ai: 'ai',
  cn: 'cn',
  dbms: 'dbms',
  ds: 'ds',
  os: 'os',
  sd: 'sd',
  notes: 'notes',
  programs: 'programs',
  prep: 'prep',
  other: 'other',
}

export function categoryFromPath(relativePath: string): DocumentCategory {
  const first = relativePath.split(/[/\\]/)[0]?.toLowerCase() ?? ''
  if (FOLDER_TO_CATEGORY[first]) return FOLDER_TO_CATEGORY[first]
  if (
    relativePath.toLowerCase().includes('interview') ||
    relativePath.toLowerCase().includes('roadmap')
  ) {
    return 'prep'
  }
  return 'other'
}

export function folderFromPath(relativePath: string): string {
  const parts = relativePath.split(/[/\\]/).filter(Boolean)
  if (parts.length <= 1) return 'Root'
  return parts[0]
}

export function typeFromFilename(name: string): DocumentType {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'txt') return 'txt'
  return 'other'
}

export function mimeFromType(type: DocumentType): string {
  if (type === 'pdf') return 'application/pdf'
  if (type === 'html') return 'text/html'
  if (type === 'txt') return 'text/plain'
  return 'application/octet-stream'
}

export function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

export function slugifyId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function pathForFolder(category: DocumentCategory, fileName: string): string {
  return `${FOLDER_NAMES[category]}/${fileName}`
}
