import { useEffect, useState } from 'react'
import { subscribeDocuments } from '../lib/documents'
import type { PlacementDocument } from '../types/document'
import { useAuth } from '../auth/AuthContext'

export function useDocuments() {
  const { user, isGuest } = useAuth()
  const [documents, setDocuments] = useState<PlacementDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user && !isGuest) {
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
        try {
          if (docs && docs.length > 0) {
            localStorage.setItem('placelyy_cached_docs', JSON.stringify(docs))
          }
        } catch {
          // ignore quota
        }
      },
      (message) => {
        // Fallback to locally cached documents if available
        try {
          const cached = localStorage.getItem('placelyy_cached_docs')
          if (cached) {
            const parsed = JSON.parse(cached) as PlacementDocument[]
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDocuments(parsed)
              setLoading(false)
              return
            }
          }
        } catch {
          // ignore
        }

        if (message.includes('permission_denied')) {
          setError(
            "Firebase Database rules currently require login for reading documents. Update database.rules.json in Firebase Console to set '.read': true for documents, or sign in with Google."
          )
        } else {
          setError(message)
        }
        setDocuments([])
        setLoading(false)
      },
    )

    return unsub
  }, [user, isGuest])

  return { documents, loading, error, source: 'realtime' as const }
}
