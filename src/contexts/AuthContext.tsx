import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User as FirebaseUser } from 'firebase/auth'

import { auth } from '../firebase'
import { authService } from '../services/authService'
import { AuthContext } from './authContextValue'
import { hasWorkspaceAccess, type AuthContextType, type UserProfile } from '../types/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const profile = await authService.getUserProfile(firebaseUser.uid)
        setUser(profile)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    const profile = await authService.login(email, password)
    setUser(profile)
  }

  const loginWithGoogle = async () => {
    const profile = await authService.signInWithGoogle()
    setUser(profile)
  }

  const signup = async (email: string, password: string, displayName: string) => {
    const profile = await authService.signup(email, password, displayName)
    setUser(profile)
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  const refreshUser = async () => {
    if (auth.currentUser) {
      const profile = await authService.getUserProfile(auth.currentUser.uid)
      setUser(profile)
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: hasWorkspaceAccess(user),
    isAdmin: user?.role === 'admin',
    isInstructor: user?.role === 'instructor' || user?.role === 'admin',
    login,
    loginWithGoogle,
    signup,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
