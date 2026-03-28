import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { hasWorkspaceAccess, type UserProfile, type UserRole } from '../types/auth'

const EARLY_ACCESS_CUTOFF = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const googleProvider = new GoogleAuthProvider()

function buildApprovalState(isApproved: boolean) {
  return {
    accountState: isApproved ? 'active' : 'pending',
    status: isApproved ? 'active' : 'pending',
    authenticated: isApproved,
  } as const
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : ''
  }

  return ''
}

export const authService = {
  async signInWithGoogle(): Promise<UserProfile> {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user

      const existingProfile = await this.getUserProfile(user.uid)

      if (existingProfile) {
        await updateDoc(doc(db, 'users', user.uid), {
          lastLogin: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        })
        return {
          ...existingProfile,
          lastLogin: new Date(),
        }
      }

      const now = new Date()
      const isEarlyAccess = now < EARLY_ACCESS_CUTOFF
      const approvalState = buildApprovalState(isEarlyAccess)

      const userProfile: Omit<UserProfile, 'uid'> = {
        email: user.email!,
        displayName: user.displayName || user.email!.split('@')[0],
        role: 'student',
        ...approvalState,
        createdAt: now,
        lastLogin: now,
        teamIds: [],
      }

      await setDoc(doc(db, 'users', user.uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return {
        uid: user.uid,
        ...userProfile,
      }
    } catch (error: unknown) {
      console.error('Google sign-in error:', error)
      throw new Error(this.getErrorMessage(getErrorCode(error)))
    }
  },

  async signup(email: string, password: string, displayName: string): Promise<UserProfile> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      const now = new Date()
      const isEarlyAccess = now < EARLY_ACCESS_CUTOFF
      const approvalState = buildApprovalState(isEarlyAccess)

      const userProfile: Omit<UserProfile, 'uid'> = {
        email: user.email!,
        displayName,
        role: 'student',
        ...approvalState,
        createdAt: now,
        lastLogin: now,
        teamIds: [],
      }

      await setDoc(doc(db, 'users', user.uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return {
        uid: user.uid,
        ...userProfile,
      }
    } catch (error: unknown) {
      console.error('Signup error:', error)
      throw new Error(this.getErrorMessage(getErrorCode(error)))
    }
  },

  async login(email: string, password: string): Promise<UserProfile> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await updateDoc(doc(db, 'users', user.uid), {
        lastLogin: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      })

      const profile = await this.getUserProfile(user.uid)
      if (!profile) {
        throw new Error('User profile not found')
      }

      return {
        ...profile,
        lastLogin: new Date(),
      }
    } catch (error: unknown) {
      console.error('Login error:', error)
      throw new Error(this.getErrorMessage(getErrorCode(error)))
    }
  },

  async logout(): Promise<void> {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Logout error:', error)
      throw new Error('Failed to logout')
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', uid)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return null
      }

      const data = docSnap.data()
      const profile: UserProfile = {
        uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        accountState: data.accountState,
        status: data.status,
        authenticated: data.authenticated,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLogin: data.lastLogin?.toDate() || new Date(),
        teamIds: data.teamIds || [],
        tierId: data.tierId,
        tierLabel: data.tierLabel,
      }

      return {
        ...profile,
        authenticated: hasWorkspaceAccess(profile),
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  },

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role,
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (error) {
      console.error('Error updating user role:', error)
      throw new Error('Failed to update user role')
    }
  },

  async approveUser(uid: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...buildApprovalState(true),
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (error) {
      console.error('Error approving user:', error)
      throw new Error('Failed to approve user')
    }
  },

  async revokeUserAccess(uid: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...buildApprovalState(false),
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (error) {
      console.error('Error revoking user access:', error)
      throw new Error('Failed to revoke user access')
    }
  },

  getErrorMessage(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered'
      case 'auth/invalid-email':
        return 'Invalid email address'
      case 'auth/operation-not-allowed':
        return 'Operation not allowed'
      case 'auth/weak-password':
        return 'Password should be at least 6 characters'
      case 'auth/user-disabled':
        return 'This account has been disabled'
      case 'auth/user-not-found':
        return 'No account found with this email'
      case 'auth/wrong-password':
        return 'Incorrect password'
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later'
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection'
      default:
        return 'An error occurred. Please try again'
    }
  },
}
