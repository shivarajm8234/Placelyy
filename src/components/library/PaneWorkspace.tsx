import { useRef, type ReactNode } from 'react'
import type { PlacementDocument } from '../../types/document'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { DocumentPane } from './DocumentPane'

interface Props {
  documents: PlacementDocument[]
}

export function PaneWorkspace({ documents }: Props) {
  const { openIds, weights, setPaneWeight } = useWorkspace()
  const openDocs = openIds
    .map((id) => documents.find((d) => d.id === id))
    .filter((d): d is PlacementDocument => Boolean(d))

  const dragRef = useRef<{
    index: number
    startX: number
    left: number
    right: number
  } | null>(null)

  function onResizeStart(index: number, clientX: number) {
    dragRef.current = {
      index,
      startX: clientX,
      left: weights[index] ?? 1,
      right: weights[index + 1] ?? 1,
    }

    function onMove(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      const delta = dx / 280
      setPaneWeight(drag.index, drag.left + delta)
      setPaneWeight(drag.index + 1, drag.right - delta)
    }

    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (openDocs.length === 0) {
    return (
      <div className="pane-empty">
        <h2>Open a document</h2>
        <p>
          Pick files from the folders on the left. You can open up to three at
          once and drag the dividers to resize.
        </p>
      </div>
    )
  }

  const nodes: ReactNode[] = []
  openDocs.forEach((doc, i) => {
    nodes.push(
      <div
        key={doc.id}
        className="pane-workspace__slot"
        style={{ flex: weights[i] ?? 1 }}
      >
        <DocumentPane doc={doc} />
      </div>,
    )
    if (i < openDocs.length - 1) {
      nodes.push(
        <button
          key={`resize-${doc.id}`}
          type="button"
          className="pane-resizer"
          aria-label="Resize panes"
          onMouseDown={(e) => onResizeStart(i, e.clientX)}
        />,
      )
    }
  })

  return <div className="pane-workspace">{nodes}</div>
}
