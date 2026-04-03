import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import type { GhostlineWorkspace, GhostlineSession } from '../ghostline/types'
import * as ghostlineService from '../ghostline/services/ghostlineService'

type ToastTone = 'default' | 'success' | 'danger'

interface ToastState {
  tone: ToastTone
  message: string
}

function formatRelativeTime(date: Date): string {
  const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function GhostlineSessionBrowserPage() {
  const navigate = useNavigate()
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { user, logout } = useAuth()
  const [workspace, setWorkspace] = useState<GhostlineWorkspace | null>(null)
  const [sessions, setSessions] = useState<GhostlineSession[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const loadData = async () => {
    if (!workspaceId || !user) return

    setLoading(true)
    try {
      const [personalWorkspaces, teamWorkspaces] = await Promise.all([
        ghostlineService.getPersonalWorkspaces(user.uid),
        ghostlineService.getTeamWorkspaces(user.uid),
      ])

      const foundWorkspace = [...personalWorkspaces, ...teamWorkspaces].find((w) => w.id === workspaceId)
      if (!foundWorkspace) {
        setToast({ tone: 'danger', message: 'Workspace not found' })
        navigate('/ghostline/workspace')
        return
      }

      setWorkspace(foundWorkspace)
      const sessionList = await ghostlineService.getSessions(workspaceId)
      setSessions(sessionList)
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to load sessions',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [workspaceId, user])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const handleCreateSession = async () => {
    if (!workspaceId || !user || creating) return

    const name = window.prompt('Name your session', `Session ${sessions.length + 1}`)
    if (!name) return

    const description = window.prompt('Description (optional)', '')

    setCreating(true)
    try {
      const session = await ghostlineService.createSession(workspaceId, user.uid, name, description || undefined)
      setToast({ tone: 'success', message: `Created ${session.name}` })
      await loadData()
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to create session',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSession = async (session: GhostlineSession) => {
    if (!window.confirm(`Delete session "${session.name}"? This will delete all runs and checkpoints.`)) {
      return
    }

    try {
      await ghostlineService.deleteSession(session.id)
      setToast({ tone: 'success', message: `Deleted ${session.name}` })
      await loadData()
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to delete session',
      })
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#020408',
        color: '#e2e8f0',
        fontFamily: "'Inter', sans-serif",
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(6, 10, 16, 0.8)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            to="/ghostline"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '-0.02em',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
            }}
          >
            <span style={{ color: '#06b6d4' }}>GHOST</span>LINE
          </Link>
          <span style={{ color: '#475569' }}>/</span>
          <Link
            to="/ghostline/workspace"
            style={{
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            Workspaces
          </Link>
          <span style={{ color: '#475569' }}>/</span>
          <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{workspace?.name || 'Loading...'}</span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {user && (
            <button
              type="button"
              onClick={() => void logout()}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px 32px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>
            {workspace?.name || 'Workspace'}
          </h1>
          {workspace?.description && (
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>
              {workspace.description}
            </p>
          )}
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div style={{ color: '#64748b', padding: '40px 0' }}>Loading sessions...</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Sessions</h2>
              <button
                type="button"
                onClick={() => void handleCreateSession()}
                disabled={creating}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#020408',
                  fontWeight: 600,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.6 : 1,
                }}
              >
                {creating ? 'Creating...' : '+ New Session'}
              </button>
            </div>

            {sessions.length === 0 ? (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '40px',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: '#64748b', marginBottom: '16px' }}>
                  No sessions yet. Create your first session to start teaching and optimizing routes.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px',
                }}
              >
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(6, 182, 212, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/ghostline/session/${session.id}`)}
                  >
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{session.name}</h3>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background:
                              session.status === 'active'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : session.status === 'completed'
                                ? 'rgba(6, 182, 212, 0.15)'
                                : 'rgba(100, 116, 139, 0.15)',
                            color:
                              session.status === 'active'
                                ? '#10b981'
                                : session.status === 'completed'
                                ? '#06b6d4'
                                : '#64748b',
                            textTransform: 'uppercase',
                          }}
                        >
                          {session.status}
                        </span>
                      </div>
                      {session.description && (
                        <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '12px' }}>
                          {session.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Runs</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{session.totalRuns}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Best Time</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#06b6d4' }}>
                          {session.bestTime ? `${session.bestTime.toFixed(2)}s` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Checkpoints</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{session.checkpointCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '2px' }}>Modified</div>
                        <div style={{ fontSize: '0.85rem' }}>{formatRelativeTime(session.lastModified)}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/ghostline/session/${session.id}`)
                        }}
                        style={{
                          padding: '8px 16px',
                          background: 'rgba(6, 182, 212, 0.1)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          borderRadius: '6px',
                          color: '#06b6d4',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Open Session
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDeleteSession(session)
                        }}
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '4px',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(21, 25, 34, 0.95)',
            border: `1px solid ${toast.tone === 'danger' ? '#ef4444' : toast.tone === 'success' ? '#10b981' : '#06b6d4'}`,
            padding: '12px 20px',
            borderRadius: '6px',
            color: '#e2e8f0',
            fontSize: '0.85rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
            zIndex: 200,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
