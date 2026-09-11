import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  DEFAULT_PAGE_HEIGHT,
  DEFAULT_PAGE_WIDTH,
  createBlankPage,
  createNewNotebook,
  drawPaperBackground,
  exportNotebookToPdfBytes,
  loadNotebook,
  saveNotebook,
} from '../../lib/notebooks'
import type {
  NotebookDocumentData,
  NotebookImage,
  NotebookPageData,
  NotebookPoint,
  NotebookShape,
  NotebookStroke,
  NotebookText,
  PaperStyle,
} from '../../types/document'
import { PdfPreviewModal } from './PdfPreviewModal'

type ActiveTool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'image'
  | 'shape'
  | 'select'

type ShapeType = 'line' | 'arrow' | 'rect' | 'circle'

const PEN_COLORS = [
  { label: 'Black', value: '#101814' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Navy', value: '#1e3a8a' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Pink', value: '#db2777' },
]

const HIGHLIGHTER_COLORS = [
  { label: 'Neon Yellow', value: '#fef08a' },
  { label: 'Soft Green', value: '#bbf7d0' },
  { label: 'Sky Blue', value: '#bae6fd' },
  { label: 'Pastel Pink', value: '#fbcfe8' },
  { label: 'Peach Orange', value: '#fed7aa' },
]

const PEN_WIDTHS = [
  { label: 'Fine', value: 1.8 },
  { label: 'Medium', value: 3.2 },
  { label: 'Bold', value: 6.0 },
  { label: 'Thick', value: 10.0 },
]

const HIGHLIGHTER_WIDTHS = [
  { label: 'Small', value: 16 },
  { label: 'Medium', value: 24 },
  { label: 'Large', value: 34 },
]

const ERASER_WIDTHS = [
  { label: 'Small', value: 12 },
  { label: 'Medium', value: 24 },
  { label: 'Large', value: 44 },
]

interface Props {
  initialDocId?: string
  defaultTitle?: string
  initialData?: NotebookDocumentData
  onClose?: () => void
  isEmbeddedPane?: boolean
}

export function PrepNotebookEditor({
  initialDocId,
  defaultTitle = 'Preparation Notes',
  initialData,
  onClose,
  isEmbeddedPane = false,
}: Props) {
  const { user, isGuest } = useAuth()

  // Document State
  const [doc, setDoc] = useState<NotebookDocumentData>(() => {
    if (initialData) return initialData
    const newDoc = createNewNotebook(
      defaultTitle,
      'prep',
      'ruled',
      user?.uid,
      user?.email || undefined,
      user?.displayName || undefined,
      initialDocId,
    )
    if (initialDocId) newDoc.id = initialDocId
    return newDoc
  })
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isWriteMode, setIsWriteMode] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Tool State
  const [tool, setTool] = useState<ActiveTool>('pen')
  const [penColor, setPenColor] = useState('#101814')
  const [penWidth, setPenWidth] = useState(2.5)
  const [highlighterColor, setHighlighterColor] = useState('#fef08a')
  const [highlighterWidth, setHighlighterWidth] = useState(22)
  const [eraserWidth, setEraserWidth] = useState(24)
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rect')
  const [shapeFill, setShapeFill] = useState('transparent')
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('ruled')
  const [zoom, setZoom] = useState(100)

  // Text Tool State
  const [fontSize, setFontSize] = useState(18)
  const [fontFamily, setFontFamily] = useState('Figtree, sans-serif')
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [activeTextId, setActiveTextId] = useState<string | null>(null)
  const [editingTextValue, setEditingTextValue] = useState('')
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null)

  // Selection / Transform State
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedItemType, setSelectedItemType] = useState<'image' | 'text' | 'shape' | null>(null)
  const [isDraggingItem, setIsDraggingItem] = useState(false)

  // Undo / Redo History
  const [history, setHistory] = useState<NotebookPageData[][]>(() => [
    JSON.parse(JSON.stringify(doc.pages)),
  ])
  const [historyIndex, setHistoryIndex] = useState(0)

  // PDF Preview State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const editingTextRef = useRef('')
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<NotebookPoint[]>([])
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)

  const activePage = doc.pages[currentPageIndex] || doc.pages[0] || createBlankPage(1, paperStyle)

  // Load document if initialDocId provided
  useEffect(() => {
    if (!initialDocId) return
    let isMounted = true
    async function fetchDoc() {
      if (!initialDocId) return
      const loaded = await loadNotebook(initialDocId)
      if (loaded && isMounted) {
        setDoc(loaded)
        if (loaded.paperStyle) setPaperStyle(loaded.paperStyle)
      } else if (isMounted) {
        const fresh = createNewNotebook(
          defaultTitle,
          'prep',
          'ruled',
          user?.uid,
          user?.email || undefined,
          user?.displayName || undefined,
          initialDocId,
        )
        fresh.id = initialDocId
        setDoc(fresh)
      }
    }
    void fetchDoc()
    return () => {
      isMounted = false
    }
  }, [initialDocId, defaultTitle, user])

  // Focus textarea when text editing starts
  useEffect(() => {
    if (activeTextId && textAreaRef.current) {
      textAreaRef.current.focus()
      textAreaRef.current.select()
    }
  }, [activeTextId])

  // Push state to history for undo/redo
  const pushHistory = useCallback((pages: NotebookPageData[]) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1)
      next.push(JSON.parse(JSON.stringify(pages)))
      if (next.length > 30) next.shift()
      return next
    })
    setHistoryIndex((prev) => Math.min(prev + 1, 29))
  }, [historyIndex])

  // Ensure overlay canvas dimensions and transform are initialized cleanly without per-move resets
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const dpr = window.devicePixelRatio || 1
    overlay.width = DEFAULT_PAGE_WIDTH * dpr
    overlay.height = DEFAULT_PAGE_HEIGHT * dpr
    const ctx = overlay.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
    }
  }, [currentPageIndex, doc.pages.length])

  // Redraw main canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !activePage) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = DEFAULT_PAGE_WIDTH
    const height = DEFAULT_PAGE_HEIGHT

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // 1. Paper Background
    drawPaperBackground(ctx, width, height, activePage.paperStyle || paperStyle)

    // 2. Images
    if (activePage.images) {
      for (const imgData of activePage.images) {
        const img = new Image()
        img.src = imgData.src
        if (img.complete) {
          ctx.drawImage(img, imgData.x, imgData.y, imgData.width, imgData.height)
        } else {
          img.onload = () => {
            const currentCanvas = canvasRef.current
            const currentCtx = currentCanvas?.getContext('2d')
            if (currentCtx) {
              currentCtx.drawImage(img, imgData.x, imgData.y, imgData.width, imgData.height)
            }
          }
        }
      }
    }

    // 3. Shapes
    if (activePage.shapes) {
      for (const shape of activePage.shapes) {
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

    // 4. Strokes
    if (activePage.strokes) {
      for (const stroke of activePage.strokes) {
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

    // 5. Text elements
    if (activePage.texts) {
      for (const textItem of activePage.texts) {
        if (textItem.id === activeTextId) continue
        ctx.save()
        const fontStyle = textItem.isItalic ? 'italic ' : ''
        const fontWeight = textItem.isBold ? 'bold ' : 'normal '
        const fSize = textItem.fontSize || 18
        const fFamily = textItem.fontFamily || 'Figtree, sans-serif'

        ctx.font = `${fontStyle}${fontWeight}${fSize}px ${fFamily}`
        ctx.fillStyle = textItem.color || '#101814'
        ctx.textBaseline = 'top'

        const lines = textItem.text.split('\n')
        const lineHeight = fSize * 1.3
        lines.forEach((line, index) => {
          ctx.fillText(line, textItem.x, textItem.y + index * lineHeight)
        })
        ctx.restore()
      }
    }
  }, [activePage, paperStyle, activeTextId])

  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent | React.MouseEvent) => {
    const canvas = overlayCanvasRef.current || canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    // getBoundingClientRect already accounts for CSS transforms (zoom),
    // so this ratio correctly maps screen pixels → canvas coords.
    const scaleX = DEFAULT_PAGE_WIDTH / rect.width
    const scaleY = DEFAULT_PAGE_HEIGHT / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  // Handle Save with user isolation & guest mode
  const handleSave = async () => {
    if (isGuest || !user) {
      setSaveStatus('saved')
      setSaveMessage('Guest Mode: Sign in to save notes')
      setTimeout(() => setSaveMessage(null), 3500)
      return
    }

    setSaveStatus('saving')
    try {
      await saveNotebook(doc, {
        uid: user?.uid,
        email: user?.email,
        displayName: user?.displayName,
        isGuest,
      })
      setSaveStatus('saved')
      setSaveMessage('Saved to cloud')
      setTimeout(() => setSaveMessage(null), 2500)
    } catch {
      setSaveStatus('unsaved')
      setSaveMessage('Save failed')
    }
  }

  // Handle Export / View as PDF
  const handleViewPdf = async () => {
    setIsGeneratingPdf(true)
    try {
      const bytes = await exportNotebookToPdfBytes(doc)
      setPdfBytes(bytes)
      setIsPdfModalOpen(true)
    } catch (err) {
      alert('Could not generate PDF: ' + (err instanceof Error ? err.message : 'Error'))
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // Handle Clipboard Image Paste (Ctrl+V)
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!isWriteMode) return
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (!blob) continue

          const reader = new FileReader()
          reader.onload = (event) => {
            const src = event.target?.result as string
            if (!src) return

            const img = new Image()
            img.onload = () => {
              let w = img.width
              let h = img.height
              const maxW = DEFAULT_PAGE_WIDTH * 0.65
              const maxH = DEFAULT_PAGE_HEIGHT * 0.5
              if (w > maxW || h > maxH) {
                const ratio = Math.min(maxW / w, maxH / h)
                w = w * ratio
                h = h * ratio
              }

              const newImage: NotebookImage = {
                id: `img-${Date.now().toString(36)}`,
                x: (DEFAULT_PAGE_WIDTH - w) / 2,
                y: 120 + Math.random() * 40,
                width: Math.round(w),
                height: Math.round(h),
                src,
              }

              setDoc((prev) => {
                const newPages = prev.pages.map((p, idx) => {
                  if (idx === currentPageIndex) {
                    return {
                      ...p,
                      images: [...(p.images || []), newImage],
                    }
                  }
                  return p
                })
                pushHistory(newPages)
                return { ...prev, pages: newPages }
              })
              setSelectedItemId(newImage.id)
              setSelectedItemType('image')
              setTool('select')
              setSaveStatus('unsaved')
            }
            img.src = src
          }
          reader.readAsDataURL(blob)
          break
        }
      }
    },
    [isWriteMode, currentPageIndex, pushHistory],
  )

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [handlePaste])

  // Handle image upload from file picker
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const src = event.target?.result as string
      if (!src) return

      const img = new Image()
      img.onload = () => {
        let w = img.width
        let h = img.height
        const maxW = DEFAULT_PAGE_WIDTH * 0.65
        const maxH = DEFAULT_PAGE_HEIGHT * 0.5
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h)
          w = w * ratio
          h = h * ratio
        }

        const newImage: NotebookImage = {
          id: `img-${Date.now().toString(36)}`,
          x: (DEFAULT_PAGE_WIDTH - w) / 2,
          y: 120,
          width: Math.round(w),
          height: Math.round(h),
          src,
        }

        setDoc((prev) => {
          const newPages = prev.pages.map((p, idx) => {
            if (idx === currentPageIndex) {
              return {
                ...p,
                images: [...(p.images || []), newImage],
              }
            }
            return p
          })
          pushHistory(newPages)
          return { ...prev, pages: newPages }
        })
        setSelectedItemId(newImage.id)
        setSelectedItemType('image')
        setTool('select')
        setSaveStatus('unsaved')
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Handle Text Submission
  const handleSaveActiveText = useCallback(
    (textOverride?: string) => {
      if (!activeTextId || !textPosition) return
      const rawText = textOverride !== undefined ? textOverride : editingTextRef.current || editingTextValue
      const textVal = rawText.trim()

      if (!textVal) {
        setActiveTextId(null)
        setEditingTextValue('')
        editingTextRef.current = ''
        setTextPosition(null)
        return
      }

      setDoc((prev) => {
        const newPages = prev.pages.map((p, idx) => {
          if (idx !== currentPageIndex) return p
          const existing = p.texts?.find((t) => t.id === activeTextId)
          if (existing) {
            return {
              ...p,
              texts: (p.texts || []).map((t) =>
                t.id === activeTextId
                  ? {
                      ...t,
                      text: textVal,
                      color: penColor,
                      fontSize,
                      fontFamily,
                      isBold,
                      isItalic,
                    }
                  : t,
              ),
            }
          }
          // New text
          const newTextItem: NotebookText = {
            id: activeTextId,
            x: textPosition.x,
            y: textPosition.y,
            text: textVal,
            color: penColor,
            fontSize,
            fontFamily,
            isBold,
            isItalic,
            width: 320,
          }
          return {
            ...p,
            texts: [...(p.texts || []), newTextItem],
          }
        })
        pushHistory(newPages)
        return { ...prev, pages: newPages }
      })

      const savedId = activeTextId
      setActiveTextId(null)
      setEditingTextValue('')
      editingTextRef.current = ''
      setTextPosition(null)
      setSaveStatus('unsaved')

      // Automatically select the saved text so user can immediately move it or see it
      setSelectedItemId(savedId)
      setSelectedItemType('text')
      setTool('select')
    },
    [
      activeTextId,
      textPosition,
      editingTextValue,
      currentPageIndex,
      penColor,
      fontSize,
      fontFamily,
      isBold,
      isItalic,
      pushHistory,
    ],
  )

  // Rock-Solid Item Dragging Handler (window-level listeners with capture for smooth, glitch-free moving)
  const handleStartDrag = useCallback(
    (
      e: React.PointerEvent | PointerEvent | React.MouseEvent,
      id: string,
      type: 'text' | 'image' | 'shape',
      initialX: number,
      initialY: number,
    ) => {
      e.stopPropagation()
      if ('preventDefault' in e) e.preventDefault()

      setSelectedItemId(id)
      setSelectedItemType(type)
      setIsDraggingItem(true)

      const startClientX = e.clientX
      const startClientY = e.clientY

      const onPointerMove = (moveEvt: PointerEvent) => {
        const zoomFactor = (zoom || 100) / 100
        const dx = (moveEvt.clientX - startClientX) / zoomFactor
        const dy = (moveEvt.clientY - startClientY) / zoomFactor

        const newX = Math.max(0, Math.min(DEFAULT_PAGE_WIDTH - 30, Math.round(initialX + dx)))
        const newY = Math.max(0, Math.min(DEFAULT_PAGE_HEIGHT - 30, Math.round(initialY + dy)))

        setDoc((prev) => {
          const newPages = prev.pages.map((p, idx) => {
            if (idx !== currentPageIndex) return p
            if (type === 'image') {
              return {
                ...p,
                images: (p.images || []).map((img) =>
                  img.id === id ? { ...img, x: newX, y: newY } : img,
                ),
              }
            }
            if (type === 'text') {
              return {
                ...p,
                texts: (p.texts || []).map((txt) =>
                  txt.id === id ? { ...txt, x: newX, y: newY } : txt,
                ),
              }
            }
            if (type === 'shape') {
              return {
                ...p,
                shapes: (p.shapes || []).map((s) => {
                  if (s.id !== id) return s
                  const width = s.endX - s.startX
                  const height = s.endY - s.startY
                  return {
                    ...s,
                    startX: newX,
                    startY: newY,
                    endX: newX + width,
                    endY: newY + height,
                  }
                }),
              }
            }
            return p
          })
          return { ...prev, pages: newPages }
        })
        setSaveStatus('unsaved')
      }

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove, { capture: true })
        window.removeEventListener('pointerup', onPointerUp, { capture: true })
        window.removeEventListener('pointercancel', onPointerUp, { capture: true })
        setIsDraggingItem(false)
        setDoc((prev) => {
          pushHistory(prev.pages)
          return prev
        })
      }

      window.addEventListener('pointermove', onPointerMove, { capture: true })
      window.addEventListener('pointerup', onPointerUp, { capture: true })
      window.addEventListener('pointercancel', onPointerUp, { capture: true })
    },
    [currentPageIndex, zoom, pushHistory],
  )

  // Pointer Down on Canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isWriteMode) return
    const { x, y } = getCanvasCoords(e)

    // Selection & Text tool: check existing items for move or selection
    if (tool === 'select' || tool === 'text') {
      // Check if clicked an image (generous padding for easier selection)
      const clickedImg = activePage.images?.slice().reverse().find((img) => {
        return x >= img.x - 8 && x <= img.x + img.width + 8 && y >= img.y - 8 && y <= img.y + img.height + 8
      })

      if (clickedImg) {
        handleStartDrag(e, clickedImg.id, 'image', clickedImg.x, clickedImg.y)
        return
      }

      // Check if clicked a text box to select/move
      const clickedText = activePage.texts?.slice().reverse().find((txt) => {
        const lineCount = txt.text.split('\n').length || 1
        const fSize = txt.fontSize || 18
        const h = fSize * 1.5 * lineCount + 18
        const maxLineLen = Math.max(...txt.text.split('\n').map((l) => l.length))
        const estW = Math.max(100, Math.min(DEFAULT_PAGE_WIDTH - txt.x, Math.max(maxLineLen * fSize * 0.65, txt.width || 0)))
        return x >= txt.x - 12 && x <= txt.x + estW + 12 && y >= txt.y - 12 && y <= txt.y + h + 12
      })

      if (clickedText) {
        if (activeTextId && activeTextId !== clickedText.id) {
          handleSaveActiveText()
        }
        setSelectedItemId(clickedText.id)
        setSelectedItemType('text')
        setTool('select')
        handleStartDrag(e, clickedText.id, 'text', clickedText.x, clickedText.y)
        return
      }

      // Check if clicked a shape
      const clickedShape = activePage.shapes?.slice().reverse().find((shape) => {
        const minX = Math.min(shape.startX, shape.endX) - 10
        const maxX = Math.max(shape.startX, shape.endX) + 10
        const minY = Math.min(shape.startY, shape.endY) - 10
        const maxY = Math.max(shape.startY, shape.endY) + 10
        return x >= minX && x <= maxX && y >= minY && y <= maxY
      })

      if (clickedShape) {
        handleStartDrag(e, clickedShape.id, 'shape', Math.min(clickedShape.startX, clickedShape.endX), Math.min(clickedShape.startY, clickedShape.endY))
        return
      }

      if (tool === 'select') {
        // Clicked empty canvas: deselect
        setSelectedItemId(null)
        setSelectedItemType(null)
        return
      }

      if (tool === 'text') {
        if (activeTextId) {
          handleSaveActiveText()
        }
        // Clicked empty canvas in text mode: start typing new text
        const newId = `text-${Date.now().toString(36)}`
        const snapX = Math.round(x)
        const snapY = Math.round(y)

        setActiveTextId(newId)
        setEditingTextValue('')
        editingTextRef.current = ''
        setTextPosition({ x: snapX, y: snapY })
        return
      }
    }

    if (tool === 'shape') {
      isDrawingRef.current = true
      shapeStartRef.current = { x, y }
      return
    }

    // Freehand Drawing (Pen, Highlighter, Eraser)
    isDrawingRef.current = true
    currentPointsRef.current = [{ x, y, pressure: e.pressure }]

    const overlay = overlayCanvasRef.current
    if (overlay) {
      const ctx = overlay.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, DEFAULT_PAGE_WIDTH, DEFAULT_PAGE_HEIGHT)
        ctx.strokeStyle =
          tool === 'highlighter' ? highlighterColor : tool === 'eraser' ? '#ef4444' : penColor
        ctx.lineWidth =
          tool === 'highlighter' ? highlighterWidth : tool === 'eraser' ? eraserWidth : penWidth
        ctx.lineCap = tool === 'highlighter' ? 'square' : 'round'
        ctx.lineJoin = 'round'
        if (tool === 'highlighter') ctx.globalAlpha = 0.5

        ctx.beginPath()
        ctx.arc(x, y, (ctx.lineWidth || 2) / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // Pointer Move on Canvas
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isWriteMode) return
    const { x, y } = getCanvasCoords(e)

    if (!isDrawingRef.current) return

    if (tool === 'shape' && shapeStartRef.current) {
      const overlay = overlayCanvasRef.current
      if (!overlay) return
      const ctx = overlay.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, DEFAULT_PAGE_WIDTH, DEFAULT_PAGE_HEIGHT)
      ctx.save()
      ctx.strokeStyle = penColor
      ctx.lineWidth = penWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (shapeFill !== 'transparent') ctx.fillStyle = shapeFill

      const sx = shapeStartRef.current.x
      const sy = shapeStartRef.current.y

      if (selectedShape === 'line') {
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(x, y)
        ctx.stroke()
      } else if (selectedShape === 'arrow') {
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(x, y)
        ctx.stroke()

        const angle = Math.atan2(y - sy, x - sx)
        const headlen = 14
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6))
        ctx.moveTo(x, y)
        ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6))
        ctx.stroke()
      } else if (selectedShape === 'rect') {
        const rx = Math.min(sx, x)
        const ry = Math.min(sy, y)
        const rw = Math.abs(x - sx)
        const rh = Math.abs(y - sy)
        if (shapeFill !== 'transparent') ctx.fillRect(rx, ry, rw, rh)
        ctx.strokeRect(rx, ry, rw, rh)
      } else if (selectedShape === 'circle') {
        const rx = Math.abs(x - sx) / 2
        const ry = Math.abs(y - sy) / 2
        const cx = Math.min(sx, x) + rx
        const cy = Math.min(sy, y) + ry
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        if (shapeFill !== 'transparent') ctx.fill()
        ctx.stroke()
      }
      ctx.restore()
      return
    }

    // Freehand stroke drawing
    currentPointsRef.current.push({ x, y, pressure: e.pressure })
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, DEFAULT_PAGE_WIDTH, DEFAULT_PAGE_HEIGHT)

    ctx.save()
    if (tool === 'highlighter') {
      ctx.globalAlpha = 0.38
      ctx.strokeStyle = highlighterColor
      ctx.lineWidth = highlighterWidth
      ctx.lineCap = 'square'
      ctx.lineJoin = 'bevel'
    } else if (tool === 'eraser') {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'
      ctx.lineWidth = eraserWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    } else {
      ctx.strokeStyle = penColor
      ctx.lineWidth = penWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }

    const pts = currentPointsRef.current
    if (pts.length > 1) {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const midX = (pts[i - 1].x + pts[i].x) / 2
        const midY = (pts[i - 1].y + pts[i].y) / 2
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY)
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Pointer Up on Canvas
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isWriteMode) return

    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const { x, y } = getCanvasCoords(e)

    const overlay = overlayCanvasRef.current
    if (overlay) {
      const ctx = overlay.getContext('2d')
      ctx?.clearRect(0, 0, DEFAULT_PAGE_WIDTH, DEFAULT_PAGE_HEIGHT)
    }

    if (tool === 'shape' && shapeStartRef.current) {
      const sx = shapeStartRef.current.x
      const sy = shapeStartRef.current.y
      shapeStartRef.current = null

      if (Math.abs(x - sx) < 4 && Math.abs(y - sy) < 4) return

      const newShape: NotebookShape = {
        id: `shape-${Date.now().toString(36)}`,
        type: selectedShape,
        startX: sx,
        startY: sy,
        endX: x,
        endY: y,
        color: penColor,
        width: penWidth,
        fillColor: shapeFill,
      }

      setDoc((prev) => {
        const newPages = prev.pages.map((p, idx) => {
          if (idx === currentPageIndex) {
            return {
              ...p,
              shapes: [...(p.shapes || []), newShape],
            }
          }
          return p
        })
        pushHistory(newPages)
        return { ...prev, pages: newPages }
      })
      setSaveStatus('unsaved')
      return
    }

    const pts = currentPointsRef.current
    currentPointsRef.current = []

    if (pts.length === 0) return

    const newStroke: NotebookStroke = {
      id: `stroke-${Date.now().toString(36)}`,
      tool: tool === 'highlighter' ? 'highlighter' : tool === 'eraser' ? 'eraser' : 'pen',
      color: tool === 'highlighter' ? highlighterColor : penColor,
      width: tool === 'highlighter' ? highlighterWidth : tool === 'eraser' ? eraserWidth : penWidth,
      points: pts,
    }

    setDoc((prev) => {
      const newPages = prev.pages.map((p, idx) => {
        if (idx === currentPageIndex) {
          return {
            ...p,
            strokes: [...(p.strokes || []), newStroke],
          }
        }
        return p
      })
      pushHistory(newPages)
      return { ...prev, pages: newPages }
    })
    setSaveStatus('unsaved')
  }

  // Handle Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1
      const restoredPages = JSON.parse(JSON.stringify(history[nextIndex]))
      setHistoryIndex(nextIndex)
      setDoc((prev) => ({ ...prev, pages: restoredPages }))
      setSaveStatus('unsaved')
    }
  }

  // Handle Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1
      const restoredPages = JSON.parse(JSON.stringify(history[nextIndex]))
      setHistoryIndex(nextIndex)
      setDoc((prev) => ({ ...prev, pages: restoredPages }))
      setSaveStatus('unsaved')
    }
  }

  // Keyboard Shortcuts
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (activeTextId) return

    if (e.key === 'Enter' || e.key === 'Escape') {
      if (selectedItemId) {
        e.preventDefault()
        setSelectedItemId(null)
        setSelectedItemType(null)
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        handleRedo()
      } else {
        handleUndo()
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault()
      handleRedo()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      void handleSave()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedItemId && selectedItemType && !activeTextId) {
        e.preventDefault()
        setDoc((prev) => {
          const newPages = prev.pages.map((p, idx) => {
            if (idx !== currentPageIndex) return p
            if (selectedItemType === 'image') {
              return { ...p, images: (p.images || []).filter((img) => img.id !== selectedItemId) }
            }
            if (selectedItemType === 'text') {
              return { ...p, texts: (p.texts || []).filter((txt) => txt.id !== selectedItemId) }
            }
            if (selectedItemType === 'shape') {
              return { ...p, shapes: (p.shapes || []).filter((s) => s.id !== selectedItemId) }
            }
            return p
          })
          pushHistory(newPages)
          return { ...prev, pages: newPages }
        })
        setSelectedItemId(null)
        setSelectedItemType(null)
        setSaveStatus('unsaved')
      }
    }
  }

  // Add New Page (Fully working & switches immediately to the new page)
  const handleAddPage = () => {
    const newPageNum = doc.pages.length + 1
    const newPage = createBlankPage(newPageNum, paperStyle)

    setDoc((prev) => {
      const newPages = [...prev.pages, newPage]
      pushHistory(newPages)
      return { ...prev, pages: newPages }
    })

    setCurrentPageIndex(doc.pages.length)
    setSelectedItemId(null)
    setActiveTextId(null)
    setSaveStatus('unsaved')
  }

  // Delete Current Page
  const handleDeletePage = () => {
    if (doc.pages.length <= 1) {
      if (confirm('Clear the current page?')) {
        const cleared = [createBlankPage(1, paperStyle)]
        setDoc((prev) => ({ ...prev, pages: cleared }))
        pushHistory(cleared)
        setSelectedItemId(null)
        setActiveTextId(null)
        setSaveStatus('unsaved')
      }
      return
    }

    if (!confirm(`Delete page ${currentPageIndex + 1}?`)) return

    const filtered = doc.pages.filter((_, idx) => idx !== currentPageIndex)
    const reindexed = filtered.map((p, idx) => ({ ...p, pageNumber: idx + 1 }))

    setDoc((prev) => ({ ...prev, pages: reindexed }))
    pushHistory(reindexed)
    setCurrentPageIndex((cur) => Math.max(0, cur - 1))
    setSelectedItemId(null)
    setActiveTextId(null)
    setSaveStatus('unsaved')
  }

  // Change Paper Style
  const handleChangePaperStyle = (style: PaperStyle) => {
    setPaperStyle(style)
    setDoc((prev) => {
      const newPages = prev.pages.map((p, idx) =>
        idx === currentPageIndex ? { ...p, paperStyle: style } : p,
      )
      pushHistory(newPages)
      return { ...prev, paperStyle: style, pages: newPages }
    })
    setSaveStatus('unsaved')
  }

  const selectedImage =
    selectedItemType === 'image'
      ? activePage.images?.find((img) => img.id === selectedItemId)
      : null

  const selectedText =
    selectedItemType === 'text'
      ? activePage.texts?.find((txt) => txt.id === selectedItemId)
      : null

  return (
    <div
      className={`prep-editor ${isEmbeddedPane ? 'prep-editor--embedded' : ''} ${isDraggingItem ? 'prep-editor--dragging' : ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      ref={editorContainerRef}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Guest Mode Notification Banner */}
      {isGuest && (
        <div className="prep-guest-banner">
          <span className="prep-guest-banner__text">
            <strong>Guest Mode:</strong> You can edit, draw, and export as PDF, but your changes are <em>not saved</em>.
          </span>
          <Link to="/login" className="prep-guest-banner__link">
            Sign in with Google to save work
          </Link>
        </div>
      )}

      {/* Top Window Bar (Emoji-free) */}
      <div className="prep-winbar">
        <div className="prep-winbar__left">
          <input
            type="text"
            className="prep-winbar__title-input"
            value={doc.title}
            onChange={(e) => {
              setDoc((prev) => ({ ...prev, title: e.target.value }))
              setSaveStatus('unsaved')
            }}
            placeholder="Document title…"
            title="Click to rename document"
          />
          <span className="prep-winbar__badge">Prep Studio</span>
        </div>

        <div className="prep-winbar__center">
          {saveMessage && <span className="prep-save-msg">{saveMessage}</span>}
          <span className={`prep-status-indicator prep-status-indicator--${isGuest ? 'guest' : saveStatus}`}>
            {isGuest
              ? 'Guest Mode (Unsaved)'
              : saveStatus === 'saved'
                ? 'Saved'
                : saveStatus === 'saving'
                  ? 'Saving…'
                  : 'Unsaved'}
          </span>
        </div>

        <div className="prep-winbar__right">
          {/* Write Mode Toggle Button */}
          <button
            type="button"
            className={`btn btn--sm ${isWriteMode ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setIsWriteMode((m) => !m)}
            title={isWriteMode ? 'Switch to View Mode' : 'Switch to Write Mode to edit & overwrite'}
          >
            {isWriteMode ? 'Write Mode' : 'View Mode'}
          </button>

          {onClose && (
            <button
              type="button"
              className="prep-winbar__close"
              onClick={onClose}
              aria-label="Close editor"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Classical Menu Bar (Emoji-free) */}
      <div className="prep-menubar">
        <div className="prep-menu-item">
          <span>File</span>
          <div className="prep-menu-dropdown">
            <button type="button" onClick={() => void handleSave()}>
              Save Document <kbd>Ctrl+S</kbd>
            </button>
            <button type="button" onClick={() => void handleViewPdf()}>
              View / Export as PDF
            </button>
            <button
              type="button"
              onClick={() => {
                const newTitle = prompt('New Note Title:', 'Preparation Notes')
                if (newTitle) {
                  setDoc(createNewNotebook(newTitle, 'prep', paperStyle, user?.uid, user?.email || undefined, user?.displayName || undefined))
                  setCurrentPageIndex(0)
                  setSaveStatus('unsaved')
                }
              }}
            >
              New Notebook
            </button>
            <button type="button" onClick={() => window.print()}>
              Print Page
            </button>
          </div>
        </div>

        <div className="prep-menu-item">
          <span>Edit</span>
          <div className="prep-menu-dropdown">
            <button type="button" disabled={historyIndex <= 0} onClick={handleUndo}>
              Undo <kbd>Ctrl+Z</kbd>
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
            >
              Redo <kbd>Ctrl+Y</kbd>
            </button>
            <button type="button" onClick={handleDeletePage}>
              Clear / Delete Page
            </button>
          </div>
        </div>

        <div className="prep-menu-item">
          <span>Paper Style</span>
          <div className="prep-menu-dropdown">
            <button
              type="button"
              className={paperStyle === 'ruled' ? 'is-active' : ''}
              onClick={() => handleChangePaperStyle('ruled')}
            >
              Ruled / Lined
            </button>
            <button
              type="button"
              className={paperStyle === 'grid' ? 'is-active' : ''}
              onClick={() => handleChangePaperStyle('grid')}
            >
              Grid / Graph
            </button>
            <button
              type="button"
              className={paperStyle === 'dotted' ? 'is-active' : ''}
              onClick={() => handleChangePaperStyle('dotted')}
            >
              Dotted
            </button>
            <button
              type="button"
              className={paperStyle === 'blank' ? 'is-active' : ''}
              onClick={() => handleChangePaperStyle('blank')}
            >
              Plain Blank
            </button>
          </div>
        </div>

        <div className="prep-menu-item">
          <span>Tools</span>
          <div className="prep-menu-dropdown">
            <button type="button" onClick={() => setTool('pen')}>
              Pen
            </button>
            <button type="button" onClick={() => setTool('highlighter')}>
              Highlighter
            </button>
            <button type="button" onClick={() => setTool('eraser')}>
              Eraser
            </button>
            <button type="button" onClick={() => setTool('text')}>
              Text (Click to type)
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Insert Photo
            </button>
            <button type="button" onClick={() => setTool('shape')}>
              Shapes
            </button>
          </div>
        </div>

        <div className="prep-menu-info">
          <span>Tip: Press <strong>Ctrl+V</strong> to paste copied images directly</span>
        </div>
      </div>

      {/* Main Toolbar 1: Primary Document Actions (Emoji-free) */}
      <div className="prep-toolbar prep-toolbar--primary">
        <div className="prep-toolgroup">
          <button
            type="button"
            className="prep-toolbtn"
            onClick={() => void handleSave()}
            title="Save note (Ctrl+S)"
          >
            Save
          </button>
          <button
            type="button"
            className="prep-toolbtn"
            onClick={() => void handleViewPdf()}
            disabled={isGeneratingPdf}
            title="View & Export as PDF"
          >
            {isGeneratingPdf ? 'Generating…' : 'PDF View'}
          </button>
          <button
            type="button"
            className="prep-toolbtn"
            onClick={() => fileInputRef.current?.click()}
            title="Insert Photo from file (or Ctrl+V to paste)"
          >
            + Photo
          </button>
        </div>

        <div className="prep-tool-divider" />

        <div className="prep-toolgroup">
          <button
            type="button"
            className="prep-toolbtn"
            disabled={historyIndex <= 0}
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            className="prep-toolbtn"
            disabled={historyIndex >= history.length - 1}
            onClick={handleRedo}
            title="Redo (Ctrl+Y)"
          >
            Redo
          </button>
        </div>

        <div className="prep-tool-divider" />

        {/* Page navigation */}
        <div className="prep-toolgroup prep-toolgroup--pages">
          <button
            type="button"
            className="prep-toolbtn"
            disabled={currentPageIndex <= 0}
            onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
            title="Previous Page"
          >
            &lt;
          </button>
          <span className="prep-page-counter">
            Page {currentPageIndex + 1} of {doc.pages.length}
          </span>
          <button
            type="button"
            className="prep-toolbtn"
            disabled={currentPageIndex >= doc.pages.length - 1}
            onClick={() => setCurrentPageIndex((p) => Math.min(doc.pages.length - 1, p + 1))}
            title="Next Page"
          >
            &gt;
          </button>
          <button
            type="button"
            className="prep-toolbtn prep-toolbtn--add"
            onClick={handleAddPage}
            title="Add New Page"
          >
            + Add Page
          </button>
          <button
            type="button"
            className="prep-toolbtn prep-toolbtn--del"
            onClick={handleDeletePage}
            title="Delete Current Page"
          >
            Delete Page
          </button>
        </div>

        <div className="prep-tool-divider" />

        {/* Paper style selector */}
        <div className="prep-toolgroup">
          <select
            className="prep-select"
            value={paperStyle}
            onChange={(e) => handleChangePaperStyle(e.target.value as PaperStyle)}
            title="Paper Background Pattern"
          >
            <option value="ruled">Lined Paper</option>
            <option value="grid">Grid Paper</option>
            <option value="dotted">Dotted Paper</option>
            <option value="blank">Plain Paper</option>
          </select>
        </div>

        <div className="prep-tool-divider" />

        {/* Zoom controls */}
        <div className="prep-toolgroup prep-toolgroup--zoom">
          <button
            type="button"
            className="prep-toolbtn"
            onClick={() => setZoom((z) => Math.max(50, z - 15))}
            title="Zoom Out"
          >
            -
          </button>
          <span className="prep-zoom-val">{zoom}%</span>
          <button
            type="button"
            className="prep-toolbtn"
            onClick={() => setZoom((z) => Math.min(200, z + 15))}
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            className="prep-toolbtn prep-toolbtn--ghost"
            onClick={() => setZoom(100)}
            title="Reset Zoom"
          >
            100%
          </button>
        </div>
      </div>

      {/* Secondary Drawing Toolbar: Tools, Brushes, Colors (Emoji-free) */}
      <div className="prep-toolbar prep-toolbar--secondary">
        <div className="prep-toolgroup">
          <button
            type="button"
            className={`prep-toolbtn prep-toolbtn--mode ${tool === 'select' ? 'is-active' : ''}`}
            onClick={() => {
              if (activeTextId) handleSaveActiveText()
              setTool('select')
            }}
            title="Select & Move Items"
          >
            Select
          </button>
          <button
            type="button"
            className={`prep-toolbtn prep-toolbtn--mode ${tool === 'pen' ? 'is-active' : ''}`}
            onClick={() => {
              if (activeTextId) handleSaveActiveText()
              setTool('pen')
            }}
            title="Pen (Freehand writing)"
          >
            Pen
          </button>
          <button
            type="button"
            className={`prep-toolbtn prep-toolbtn--mode ${tool === 'highlighter' ? 'is-active' : ''}`}
            onClick={() => {
              if (activeTextId) handleSaveActiveText()
              setTool('highlighter')
            }}
            title="Highlighter (Semi-transparent)"
          >
            Highlighter
          </button>
          <button
            type="button"
            className={`prep-toolbtn prep-toolbtn--mode ${tool === 'eraser' ? 'is-active' : ''}`}
            onClick={() => {
              if (activeTextId) handleSaveActiveText()
              setTool('eraser')
            }}
            title="Eraser"
          >
            Eraser
          </button>
          <button
            type="button"
            className={`prep-toolbtn prep-toolbtn--mode ${tool === 'text' ? 'is-active' : ''}`}
            onClick={() => setTool('text')}
            title="Text Tool - Click on paper to type notes"
          >
            Text (T)
          </button>
          <button
            type="button"
            className={`prep-toolbtn prep-toolbtn--mode ${tool === 'shape' ? 'is-active' : ''}`}
            onClick={() => {
              if (activeTextId) handleSaveActiveText()
              setTool('shape')
            }}
            title="Draw Shapes"
          >
            Shapes
          </button>
        </div>

        <div className="prep-tool-divider" />

        {/* Thickness / Width selector */}
        {tool === 'pen' && (
          <div className="prep-toolgroup">
            <span className="prep-toolgroup__label">Size:</span>
            {PEN_WIDTHS.map((pw) => (
              <button
                key={pw.value}
                type="button"
                className={`prep-width-swatch ${penWidth === pw.value ? 'is-active' : ''}`}
                onClick={() => setPenWidth(pw.value)}
                title={`${pw.label} (${pw.value}px)`}
              >
                <span
                  className="prep-width-dot"
                  style={{ width: pw.value * 2.5, height: pw.value * 2.5 }}
                />
              </button>
            ))}
          </div>
        )}

        {tool === 'highlighter' && (
          <div className="prep-toolgroup">
            <span className="prep-toolgroup__label">Size:</span>
            {HIGHLIGHTER_WIDTHS.map((hw) => (
              <button
                key={hw.value}
                type="button"
                className={`prep-width-swatch ${highlighterWidth === hw.value ? 'is-active' : ''}`}
                onClick={() => setHighlighterWidth(hw.value)}
                title={`${hw.label} (${hw.value}px)`}
              >
                <span
                  className="prep-width-dot"
                  style={{ width: hw.value * 0.8, height: hw.value * 0.8 }}
                />
              </button>
            ))}
          </div>
        )}

        {tool === 'eraser' && (
          <div className="prep-toolgroup">
            <span className="prep-toolgroup__label">Size:</span>
            {ERASER_WIDTHS.map((ew) => (
              <button
                key={ew.value}
                type="button"
                className={`prep-width-swatch ${eraserWidth === ew.value ? 'is-active' : ''}`}
                onClick={() => setEraserWidth(ew.value)}
                title={`${ew.label} (${ew.value}px)`}
              >
                <span
                  className="prep-width-dot"
                  style={{ width: ew.value * 0.7, height: ew.value * 0.7 }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Shape selector when Shape tool is active */}
        {tool === 'shape' && (
          <div className="prep-toolgroup">
            <button
              type="button"
              className={`prep-toolbtn ${selectedShape === 'rect' ? 'is-active' : ''}`}
              onClick={() => setSelectedShape('rect')}
              title="Rectangle"
            >
              Rect
            </button>
            <button
              type="button"
              className={`prep-toolbtn ${selectedShape === 'circle' ? 'is-active' : ''}`}
              onClick={() => setSelectedShape('circle')}
              title="Circle"
            >
              Circle
            </button>
            <button
              type="button"
              className={`prep-toolbtn ${selectedShape === 'line' ? 'is-active' : ''}`}
              onClick={() => setSelectedShape('line')}
              title="Line"
            >
              Line
            </button>
            <button
              type="button"
              className={`prep-toolbtn ${selectedShape === 'arrow' ? 'is-active' : ''}`}
              onClick={() => setSelectedShape('arrow')}
              title="Arrow"
            >
              Arrow
            </button>
            <button
              type="button"
              className={`prep-toolbtn ${shapeFill !== 'transparent' ? 'is-active' : ''}`}
              onClick={() =>
                setShapeFill((f) => (f === 'transparent' ? 'rgba(37, 99, 235, 0.15)' : 'transparent'))
              }
              title="Toggle shape background fill"
            >
              {shapeFill !== 'transparent' ? 'Filled' : 'Outline'}
            </button>
          </div>
        )}

        {/* Text tool formatting options */}
        {tool === 'text' && (
          <div className="prep-toolgroup">
            <span className="prep-toolgroup__label">Click to type:</span>
            <select
              className="prep-select"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
            >
              <option value="Figtree, sans-serif">Sans-serif</option>
              <option value="'Courier New', monospace">Monospace</option>
              <option value="Georgia, serif">Serif</option>
            </select>
            <select
              className="prep-select"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            >
              <option value={14}>14px</option>
              <option value={18}>18px</option>
              <option value={24}>24px</option>
              <option value={32}>32px</option>
            </select>
            <button
              type="button"
              className={`prep-toolbtn ${isBold ? 'is-active' : ''}`}
              onClick={() => setIsBold((b) => !b)}
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`prep-toolbtn ${isItalic ? 'is-active' : ''}`}
              onClick={() => setIsItalic((i) => !i)}
              title="Italic"
            >
              <em>I</em>
            </button>
          </div>
        )}

        <div className="prep-tool-divider" />

        {/* Color Palette Swatches */}
        {(tool === 'pen' || tool === 'text' || tool === 'shape') && (
          <div className="prep-toolgroup prep-toolgroup--colors">
            {PEN_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`prep-color-swatch ${penColor === c.value ? 'is-active' : ''}`}
                style={{ backgroundColor: c.value }}
                onClick={() => setPenColor(c.value)}
                title={c.label}
              />
            ))}
            <label className="prep-color-picker-label" title="Custom color">
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                className="prep-color-picker"
              />
              <span className="prep-color-picker-text">Color</span>
            </label>
          </div>
        )}

        {tool === 'highlighter' && (
          <div className="prep-toolgroup prep-toolgroup--colors">
            {HIGHLIGHTER_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`prep-color-swatch ${highlighterColor === c.value ? 'is-active' : ''}`}
                style={{ backgroundColor: c.value }}
                onClick={() => setHighlighterColor(c.value)}
                title={c.label}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Interactive Ruled Paper Canvas Area */}
      <div className="prep-workspace-viewport">
        <div
          className="prep-canvas-container"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* Base Ruled Paper Canvas */}
          <canvas
            ref={canvasRef}
            className="prep-canvas"
            width={DEFAULT_PAGE_WIDTH}
            height={DEFAULT_PAGE_HEIGHT}
          />

          {/* Interactive Stroke and Drawing Overlay Canvas */}
          <canvas
            ref={overlayCanvasRef}
            className={`prep-canvas-overlay ${tool === 'text' ? 'prep-canvas-overlay--text' : tool === 'select' ? 'prep-canvas-overlay--select' : ''}`}
            width={DEFAULT_PAGE_WIDTH}
            height={DEFAULT_PAGE_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {/* Truly Inline Text Editor - renders directly on paper */}
          {activeTextId && textPosition && (
            <div
              className="prep-text-inline"
              style={{
                left: textPosition.x,
                top: textPosition.y,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="prep-text-inline__box">
                <textarea
                  ref={textAreaRef}
                  className="prep-text-inline__input"
                  style={{
                    fontFamily,
                    fontSize: `${fontSize}px`,
                    color: penColor,
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    lineHeight: `${fontSize * 1.35}px`,
                    minWidth: '220px',
                    width: `${Math.min(460, Math.max(220, DEFAULT_PAGE_WIDTH - textPosition.x - 30))}px`,
                    minHeight: `${Math.max(fontSize * 1.8, 38)}px`,
                  }}
                  value={editingTextValue}
                  onChange={(e) => {
                    setEditingTextValue(e.target.value)
                    editingTextRef.current = e.target.value
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSaveActiveText(e.currentTarget.value)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setActiveTextId(null)
                      setEditingTextValue('')
                      editingTextRef.current = ''
                      setTextPosition(null)
                    }
                    e.stopPropagation()
                  }}
                  placeholder="Type notes here… (Enter ↵ to save, Shift+Enter for newline)"
                  autoFocus
                />
                <div className="prep-text-inline__toolbar" onPointerDown={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="prep-text-inline__btn prep-text-inline__btn--save"
                    onClick={() => handleSaveActiveText()}
                    title="Save text (Enter)"
                  >
                    ✓ Done
                  </button>
                  <button
                    type="button"
                    className="prep-text-inline__btn prep-text-inline__btn--cancel"
                    onClick={() => {
                      setActiveTextId(null)
                      setEditingTextValue('')
                      editingTextRef.current = ''
                      setTextPosition(null)
                    }}
                    title="Cancel (Esc)"
                  >
                    ✕ Cancel
                  </button>
                  <div className="prep-text-inline__format-btns">
                    <button
                      type="button"
                      className={`prep-format-btn ${isBold ? 'is-active' : ''}`}
                      onClick={() => setIsBold(!isBold)}
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      className={`prep-format-btn ${isItalic ? 'is-active' : ''}`}
                      onClick={() => setIsItalic(!isItalic)}
                      title="Italic"
                    >
                      I
                    </button>
                  </div>
                  <span className="prep-text-inline__hint">Enter ↵ to save</span>
                </div>
              </div>
            </div>
          )}

          {/* Selection Box for Selected Text */}
          {/* Selection Box for Selected Text */}
          {selectedText && (tool === 'select' || tool === 'text') && (
            (() => {
              const fSize = selectedText.fontSize || 18
              const lineCount = selectedText.text.split('\n').length || 1
              const maxLineLen = Math.max(...selectedText.text.split('\n').map((l) => l.length))
              const estW = Math.max(100, Math.min(DEFAULT_PAGE_WIDTH - selectedText.x, Math.max(maxLineLen * fSize * 0.65, selectedText.width || 0)))
              return (
                <div
                  className="prep-selection-box"
                  style={{
                    left: selectedText.x - 4,
                    top: selectedText.y - 4,
                    width: estW + 8,
                    height: fSize * 1.5 * lineCount + 14,
                  }}
                  onPointerDown={(e) => handleStartDrag(e, selectedText.id, 'text', selectedText.x, selectedText.y)}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setActiveTextId(selectedText.id)
                    setEditingTextValue(selectedText.text)
                    editingTextRef.current = selectedText.text
                    setTextPosition({ x: selectedText.x, y: selectedText.y })
                    setFontSize(fSize)
                    setFontFamily(selectedText.fontFamily || fontFamily)
                    setIsBold(selectedText.isBold || false)
                    setIsItalic(selectedText.isItalic || false)
                    setPenColor(selectedText.color || penColor)
                    setTool('text')
                    setSelectedItemId(null)
                    setSelectedItemType(null)
                  }}
                >
                  <div className="prep-selection-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                    <span className="prep-selection-tag">Text</span>
                    <button
                      type="button"
                      className="prep-selection-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveTextId(selectedText.id)
                        setEditingTextValue(selectedText.text)
                        editingTextRef.current = selectedText.text
                        setTextPosition({ x: selectedText.x, y: selectedText.y })
                        setFontSize(fSize)
                        setFontFamily(selectedText.fontFamily || fontFamily)
                        setIsBold(selectedText.isBold || false)
                        setIsItalic(selectedText.isItalic || false)
                        setPenColor(selectedText.color || penColor)
                        setTool('text')
                        setSelectedItemId(null)
                        setSelectedItemType(null)
                      }}
                      title="Edit text inline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="prep-selection-btn prep-selection-btn--del"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDoc((prev) => {
                          const newPages = prev.pages.map((p, idx) =>
                            idx === currentPageIndex
                              ? { ...p, texts: (p.texts || []).filter((t) => t.id !== selectedText.id) }
                              : p,
                          )
                          pushHistory(newPages)
                          return { ...prev, pages: newPages }
                        })
                        setSelectedItemId(null)
                        setSelectedItemType(null)
                        setSaveStatus('unsaved')
                      }}
                      title="Delete text"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })()
          )}

          {/* Selection Box for Pasted Image */}
          {selectedImage && (tool === 'select' || tool === 'text') && (
            <div
              className="prep-selection-box"
              style={{
                left: selectedImage.x,
                top: selectedImage.y,
                width: selectedImage.width,
                height: selectedImage.height,
              }}
              onPointerDown={(e) => handleStartDrag(e, selectedImage.id, 'image', selectedImage.x, selectedImage.y)}
            >
              <div className="prep-selection-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                <span className="prep-selection-tag">Photo</span>
                <button
                  type="button"
                  className="prep-selection-btn prep-selection-btn--del"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDoc((prev) => {
                      const newPages = prev.pages.map((p, idx) =>
                        idx === currentPageIndex
                          ? { ...p, images: (p.images || []).filter((img) => img.id !== selectedImage.id) }
                          : p,
                      )
                      pushHistory(newPages)
                      return { ...prev, pages: newPages }
                    })
                    setSelectedItemId(null)
                    setSelectedItemType(null)
                    setSaveStatus('unsaved')
                  }}
                  title="Delete image"
                >
                  Delete
                </button>
              </div>

              {/* Resize Handle at Bottom-Right */}
              <div
                className="prep-resize-handle"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  const startX = e.clientX
                  const startY = e.clientY
                  const startW = selectedImage.width
                  const startH = selectedImage.height

                  const onMove = (moveEvt: PointerEvent) => {
                    const dx = (moveEvt.clientX - startX) * (100 / zoom)
                    const dy = (moveEvt.clientY - startY) * (100 / zoom)
                    const newW = Math.max(60, startW + dx)
                    const newH = Math.max(40, startH + dy)

                    setDoc((prev) => {
                      const newPages = prev.pages.map((p, idx) =>
                        idx === currentPageIndex
                          ? {
                              ...p,
                              images: (p.images || []).map((img) =>
                                img.id === selectedImage.id
                                  ? { ...img, width: Math.round(newW), height: Math.round(newH) }
                                  : img,
                              ),
                            }
                          : p,
                      )
                      return { ...prev, pages: newPages }
                    })
                  }

                  const onUp = () => {
                    window.removeEventListener('pointermove', onMove)
                    window.removeEventListener('pointerup', onUp)
                    pushHistory(doc.pages)
                    setSaveStatus('unsaved')
                  }

                  window.addEventListener('pointermove', onMove)
                  window.addEventListener('pointerup', onUp)
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar (Emoji-free) */}
      <div className="prep-statusbar">
        <div className="prep-statusbar__left">
          <span>
            Page <strong>{currentPageIndex + 1}</strong> of {doc.pages.length}
          </span>
          <span className="prep-statusbar__divider">|</span>
          <span>
            Style: <strong>{paperStyle.toUpperCase()}</strong>
          </span>
          <span className="prep-statusbar__divider">|</span>
          <span>
            Tool: <strong>{tool.toUpperCase()}</strong>
          </span>
        </div>

        <div className="prep-statusbar__right">
          <span className="prep-statusbar__tip">
            {isGuest
              ? 'Guest Mode (Saving Disabled)'
              : isWriteMode
                ? 'Write Mode Active'
                : 'Read Only Mode'}
          </span>
          <span className="prep-statusbar__divider">|</span>
          <span>Zoom: {zoom}%</span>
        </div>
      </div>

      {/* PDF View / Export Modal */}
      <PdfPreviewModal
        pdfBytes={pdfBytes}
        title={doc.title}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />
    </div>
  )
}
