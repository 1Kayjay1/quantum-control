import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireRole?: UserRole | UserRole[]
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true,
  requireRole 
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth()

  // Show nothing while loading (prevents flash of wrong content)
  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#050505',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f59e0b',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '14px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/>
            </svg>
          </div>
          <div>LOADING...</div>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Not logged in - redirect to login
  if (requireAuth && !user) {
    return <Navigate to="/login" replace />
  }

  // Logged in but not authenticated (waiting for approval) - redirect to landing
  if (requireAuth && user && !isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Check role requirements
  if (requireRole && user) {
    const roles = Array.isArray(requireRole) ? requireRole : [requireRole]
    if (!roles.includes(user.role)) {
      // Insufficient role - redirect to landing
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}

