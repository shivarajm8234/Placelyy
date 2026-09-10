import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const MAX_PANES = 3

interface WorkspaceContextValue {
  openIds: string[]
  activeId: string | null
  openDoc: (id: string) => void
  closeDoc: (id: string) => void
  focusDoc: (id: string) => void
  clearOpen: () => void
  /** Flex weights for open panes (same length as openIds) */
  weights: number[]
  setPaneWeight: (index: number, weight: number) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [openIds, setOpenIds] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [weights, setWeights] = useState<number[]>([])

  const openDoc = useCallback((id: string) => {
    setOpenIds((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id].slice(-MAX_PANES)
      setWeights((w) => {
        if (prev.includes(id)) return w
        const trimmed = prev.length >= MAX_PANES ? w.slice(-(MAX_PANES - 1)) : w
        return [...trimmed, 1]
      })
      return next
    })
    setActiveId(id)
  }, [])

  const closeDoc = useCallback((id: string) => {
    setOpenIds((prev) => {
      const idx = prev.indexOf(id)
      const next = prev.filter((x) => x !== id)
      setWeights((w) => (idx >= 0 ? w.filter((_, i) => i !== idx) : w))
      setActiveId((cur) => {
        if (cur !== id) return cur
        return next[next.length - 1] ?? null
      })
      return next
    })
  }, [])

  const focusDoc = useCallback((id: string) => {
    setActiveId(id)
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id].slice(-MAX_PANES)))
  }, [])

  const clearOpen = useCallback(() => {
    setOpenIds([])
    setActiveId(null)
    setWeights([])
  }, [])

  const setPaneWeight = useCallback((index: number, weight: number) => {
    setWeights((prev) => {
      const next = [...prev]
      if (index < 0 || index >= next.length) return prev
      next[index] = Math.max(0.35, weight)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      openIds,
      activeId,
      openDoc,
      closeDoc,
      focusDoc,
      clearOpen,
      weights: weights.length === openIds.length ? weights : openIds.map(() => 1),
      setPaneWeight,
    }),
    [
      openIds,
      activeId,
      openDoc,
      closeDoc,
      focusDoc,
      clearOpen,
      weights,
      setPaneWeight,
    ],
  )

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
