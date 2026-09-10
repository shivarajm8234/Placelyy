import { useEffect, useState } from 'react'
import { subscribeDocuments } from '../lib/documents'
import type { PlacementDocument } from '../types/document'
import { useAuth } from '../auth/AuthContext'

export function useDocuments() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<PlacementDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setDocuments([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const unsub = subscribeDocuments(
      (docs) => {
        setDocuments(docs)
        setLoading(false)
      },
      (message) => {
        setError(message)
        setDocuments([])
        setLoading(false)
      },
    )

    return unsub
  }, [user])

  return { documents, loading, error, source: 'realtime' as const }
}
