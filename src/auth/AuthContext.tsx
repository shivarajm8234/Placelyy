import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { ref as dbRef, set } from 'firebase/database'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isAdminEmail } from '../config/admin'
import { auth, database, googleProvider } from '../firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  isGuest: boolean
  signInWithGoogle: () => Promise<void>
  continueAsGuest: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return localStorage.getItem('placelyy_guest_mode') === 'true'
    } catch {
      return false
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next)
      if (next?.isAnonymous) {
        // Anonymous Firebase session for Guest Mode
        setIsGuest(true)
        setLoading(false)
        return
      }

      if (next) {
        setIsGuest(false)
        try {
          localStorage.removeItem('placelyy_guest_mode')
        } catch {
          // ignore
        }
        // Sync user profile to Firebase if permission allows
        const userProfile = {
          uid: next.uid,
          email: next.email,
          displayName: next.displayName,
          photoURL: next.photoURL,
          lastActive: new Date().toISOString(),
        }
        set(dbRef(database, `users/${next.uid}`), userProfile).catch(() => {
          // Ignore permission_denied or offline errors
        })
      } else {
        const isStoredGuest = localStorage.getItem('placelyy_guest_mode') === 'true'
        setIsGuest(isStoredGuest)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAdmin: !isGuest && !user?.isAnonymous && isAdminEmail(user?.email),
      isGuest,
      async signInWithGoogle() {
        setError(null)
        try {
          await signInWithPopup(auth, googleProvider)
          setIsGuest(false)
          try {
            localStorage.removeItem('placelyy_guest_mode')
          } catch {
            // ignore
          }
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'Google sign-in failed'
          setError(message)
          throw e
        }
      },
      async continueAsGuest() {
        setError(null)
        setIsGuest(true)
        try {
          localStorage.setItem('placelyy_guest_mode', 'true')
        } catch {
          // ignore
        }
        try {
          await signInAnonymously(auth)
        } catch {
          // If Anonymous Auth is not enabled in Firebase Console, guest mode continues with local access
        }
      },
      async signOut() {
        setError(null)
        setIsGuest(false)
        try {
          localStorage.removeItem('placelyy_guest_mode')
        } catch {
          // ignore
        }
        if (auth.currentUser) {
          await firebaseSignOut(auth)
        }
        setUser(null)
      },
    }),
    [user, isGuest, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
