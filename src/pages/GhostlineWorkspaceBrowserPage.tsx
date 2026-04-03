import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import type { GhostlineWorkspace } from '../ghostline/types'
import * as ghostlineService from '../ghostline/services/ghostlineService'

type ToastTone = 'default' | 'success' | 'danger'

interface ToastState {
  tone: ToastTone
  message: string
}

export function GhostlineWorkspaceBrowserPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [workspaces, setWorkspaces] = useState<GhostlineWorkspace[]>([])
  const [teamWorkspaces, setTeamWorkspaces] = useState<GhostlineWorkspace[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const loadWorkspaces = async () => {
    if (!user) return

    setLoading(true)
    try {
      const [personal, team] = await Promise.all([
        ghostlineService.getPersonalWorkspaces(user.uid),
        ghostlineService.getTeamWorkspaces(user.uid),
      ])
      setWorkspaces(personal)
      setTeamWorkspaces(team)
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to load workspaces',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWorkspaces()
  }, [user])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const handleCreateWorkspace = async () => {
    if (!user || creating) return

    const name = window.prompt('Name your Ghostline workspace', `Workspace ${workspaces.length + 1}`)
    if (!name) return

    const description = window.prompt('Description (optional)', '')

    setCreating(true)
    try {
      const workspace = await ghostlineService.createWorkspace(user.uid, name, 'personal', description || undefined)
      setToast({ tone: 'success', message: `Created ${workspace.name}` })
      await loadWorkspaces()
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to create workspace',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteWorkspace = async (workspace: GhostlineWorkspace) => {
    if (!window.confirm(`Delete workspace "${workspace.name}"? This will delete all sessions and data.`)) {
      return
    }

    try {
      await ghostlineService.deleteWorkspace(workspace.id)
      setToast({ tone: 'success', message: `Deleted ${workspace.name}` })
      await loadWorkspaces()
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to delete workspace',
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

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link
            to="/"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'transparent',
              color: '#94a3b8',
              textDecoration: 'none',
            }}
          >
            ← Quantum Control
          </Link>
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
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>Ghostline Workspaces</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Select a workspace to view sessions, or create a new one to get started.
          </p>
        </div>

        {loading ? (
          <div style={{ color: '#64748b', padding: '40px 0' }}>Loading workspaces...</div>
        ) : (
          <>
            {/* Personal Workspaces */}
            <section style={{ marginBottom: '48px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Personal Workspaces</h2>
                <button
                  type="button"
                  onClick={() => void handleCreateWorkspace()}
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
                  {creating ? 'Creating...' : '+ New Workspace'}
                </button>
              </div>

              {workspaces.length === 0 ? (
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
                    No workspaces yet. Create your first workspace to start optimizing routes.
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
                  {workspaces.map((workspace) => (
                    <div
                      key={workspace.id}
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
                      onClick={() => navigate(`/ghostline/workspace/${workspace.id}`)}
                    >
                      <div style={{ marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>
                          {workspace.name}
                        </h3>
                        {workspace.description && (
                          <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            {workspace.description}
                          </p>
                        )}
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {workspace.sessionIds.length} session{workspace.sessionIds.length !== 1 ? 's' : ''}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDeleteWorkspace(workspace)
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
            </section>

            {/* Team Workspaces */}
            {teamWorkspaces.length > 0 && (
              <section>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px' }}>Team Workspaces</h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px',
                  }}
                >
                  {teamWorkspaces.map((workspace) => (
                    <div
                      key={workspace.id}
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
                      onClick={() => navigate(`/ghostline/workspace/${workspace.id}`)}
                    >
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{workspace.name}</h3>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(6, 182, 212, 0.15)',
                              color: '#06b6d4',
                              textTransform: 'uppercase',
                            }}
                          >
                            Team
                          </span>
                        </div>
                        {workspace.description && (
                          <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            {workspace.description}
                          </p>
                        )}
                      </div>

                      <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: '#64748b' }}>
                        {workspace.sessionIds.length} session{workspace.sessionIds.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
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
