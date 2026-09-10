import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isAdminEmail } from '../config/admin'
import { auth, googleProvider } from '../firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
    })
    return unsub
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAdmin: isAdminEmail(user?.email),
      async signInWithGoogle() {
        setError(null)
        try {
          await signInWithPopup(auth, googleProvider)
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'Google sign-in failed'
          setError(message)
          throw e
        }
      },
      async signOut() {
        setError(null)
        await firebaseSignOut(auth)
      },
    }),
    [user, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
