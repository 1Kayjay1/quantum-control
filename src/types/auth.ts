export type UserRole = 'student' | 'instructor' | 'admin'
export type AccountState = 'active' | 'pending' | 'suspended' | 'disabled'
export type ApprovalStatus = 'active' | 'pending' | 'revoked' | 'disabled'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  accountState?: AccountState
  status?: ApprovalStatus
  authenticated?: boolean  // Keep for backwards compatibility
  createdAt: Date
  lastLogin: Date
  teamIds?: string[]
  tierId?: string
  tierLabel?: string
}

export function hasWorkspaceAccess(user: UserProfile | null | undefined): boolean {
  if (!user) {
    return false
  }

  const hasActiveFirestoreState = user.accountState === 'active' && user.status === 'active'
  return hasActiveFirestoreState || user.authenticated === true
}

export interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isInstructor: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  signup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export interface Workspace {
  id: string
  name: string
  ownerId: string
  members: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Mission {
  id: string
  title: string
  workspaceId: string
  status: 'draft' | 'published'
  lastModified: Date
  duplicatedFrom?: string
  data: unknown // The actual mission data from your existing system
}

export interface Team {
  id: string
  name: string
  description: string
  members: string[]
  instructorIds: string[]
  createdAt: Date
  createdBy: string
}

