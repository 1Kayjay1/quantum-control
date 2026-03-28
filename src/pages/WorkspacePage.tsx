import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as THREE from 'three'

import { useAuth } from '../hooks/useAuth'
import { workspaceService } from '../services/workspaceService'
import type { Mission } from '../types/mission'
import type { Workspace } from '../types/workspace'

type ToastTone = 'default' | 'success' | 'danger'

interface ToastState {
  tone: ToastTone
  message: string
}

interface MenuState {
  mission: Mission
  x: number
  y: number
}

interface ShareState {
  mission: Mission
}

function formatRelativeTime(value: Date) {
  const minutes = Math.max(1, Math.floor((Date.now() - value.getTime()) / 60000))
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function TerrainBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050505, 0.002)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 5, 10)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const geometry = new THREE.PlaneGeometry(60, 60, 40, 40)
    const count = geometry.attributes.position.count

    for (let index = 0; index < count; index += 1) {
      geometry.attributes.position.setZ(index, Math.random())
    }

    const material = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.05,
      transparent: true,
      opacity: 0.3,
    })

    const terrain = new THREE.Points(geometry, material)
    terrain.rotation.x = -Math.PI / 2
    scene.add(terrain)

    let mouseX = 0
    let mouseY = 0

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) * 0.001
      mouseY = (event.clientY - window.innerHeight / 2) * 0.001
    }

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    const clock = new THREE.Clock()
    let animationFrame = 0

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate)
      const time = clock.getElapsedTime()

      const positions = terrain.geometry.attributes.position
      for (let index = 0; index < count; index += 1) {
        const x = positions.getX(index)
        const y = positions.getY(index)
        positions.setZ(index, Math.sin(x / 2 + time) * 0.5 + Math.cos(y / 2 + time) * 0.5)
      }
      positions.needsUpdate = true

      camera.position.x += (mouseX * 5 - camera.position.x) * 0.02
      camera.position.y += (-mouseY * 5 + 5 - camera.position.y) * 0.02
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }

    document.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', handleResize)
    animate()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      container.removeChild(renderer.domElement)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: 'radial-gradient(circle at center, rgba(5,5,5,0.6) 0%, rgba(5,5,5,0.95) 80%)',
      }}
    />
  )
}

export function WorkspacePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [teamWorkspaces, setTeamWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [shareState, setShareState] = useState<ShareState | null>(null)

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  )

  const sortedMissions = useMemo(() => {
    const pinned = new Set(selectedWorkspace?.pinnedMissionIds ?? [])
    return [...missions].sort((left, right) => {
      const leftPinned = pinned.has(left.id) ? 1 : 0
      const rightPinned = pinned.has(right.id) ? 1 : 0
      if (leftPinned !== rightPinned) {
        return rightPinned - leftPinned
      }
      return right.lastModified.getTime() - left.lastModified.getTime()
    })
  }, [missions, selectedWorkspace])

  const loadChrome = async (preferredWorkspaceId?: string | null) => {
    const [personalWorkspaces, availableTeamWorkspaces] = await Promise.all([
      workspaceService.getPersonalWorkspaces(),
      workspaceService.getTeamWorkspaces(),
    ])

    setWorkspaces(personalWorkspaces)
    setTeamWorkspaces(availableTeamWorkspaces)
    const nextWorkspaceId = preferredWorkspaceId ?? personalWorkspaces[0]?.id ?? null
    setSelectedWorkspaceId(nextWorkspaceId)
    return nextWorkspaceId
  }

  const refreshMissions = async (workspaceId: string) => {
    const missionList = await workspaceService.getMissions(workspaceId)
    setMissions(missionList)
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const nextWorkspaceId = await loadChrome(selectedWorkspaceId)
        if (cancelled) {
          return
        }

        if (!nextWorkspaceId) {
          setMissions([])
          return
        }

        await refreshMissions(nextWorkspaceId)
      } catch (error) {
        if (!cancelled) {
          setToast({
            tone: 'danger',
            message: error instanceof Error ? error.message : 'Failed to load workspace.',
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [selectedWorkspaceId])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!menu) {
      return
    }

    const close = () => setMenu(null)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('click', close)
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', close)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [menu])

  const handleCreateWorkspace = async () => {
    if (creatingWorkspace) {
      return
    }

    const name = window.prompt('Name your personal workspace', `Workspace ${workspaces.length + 1}`)
    if (!name) {
      return
    }

    setCreatingWorkspace(true)
    try {
      const workspace = await workspaceService.createWorkspace(name, 'personal')
      setToast({ tone: 'success', message: `Created ${workspace.name}` })
      await loadChrome(workspace.id)
      await refreshMissions(workspace.id)
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Unable to create workspace.',
      })
    } finally {
      setCreatingWorkspace(false)
    }
  }

  const handleCreateMission = async () => {
    if (!selectedWorkspaceId || creating) {
      return
    }

    setCreating(true)
    try {
      const created = await workspaceService.createMission(
        selectedWorkspaceId,
        `New Mission ${String(missions.length + 1).padStart(2, '0')}`,
      )
      await refreshMissions(selectedWorkspaceId)
      setToast({ tone: 'success', message: `Created ${created.title}` })
      navigate(`/workspace/${created.id}`)
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Unable to create mission.',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDuplicate = async (mission: Mission, destinationWorkspaceId?: string) => {
    try {
      const duplicate = await workspaceService.duplicateMission(mission.id, destinationWorkspaceId)
      if (selectedWorkspaceId) {
        await refreshMissions(selectedWorkspaceId)
      }
      await loadChrome(selectedWorkspaceId)
      setToast({ tone: 'success', message: `Duplicated ${mission.title}` })
      return duplicate
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Unable to duplicate mission.',
      })
      return null
    }
  }

  const handleDelete = async (mission: Mission) => {
    try {
      await workspaceService.deleteMission(mission.id)
      if (selectedWorkspaceId) {
        await refreshMissions(selectedWorkspaceId)
      }
      setToast({ tone: 'success', message: `Deleted ${mission.title}` })
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Unable to delete mission.',
      })
    }
  }

  const handleTogglePin = async (mission: Mission) => {
    if (!selectedWorkspaceId) {
      return
    }

    try {
      const nextPins = await workspaceService.togglePinnedMission(selectedWorkspaceId, mission.id)
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === selectedWorkspaceId
            ? { ...workspace, pinnedMissionIds: nextPins }
            : workspace,
        ),
      )
      setToast({
        tone: 'success',
        message: nextPins.includes(mission.id) ? `Pinned ${mission.title}` : `Unpinned ${mission.title}`,
      })
    } catch (error) {
      setToast({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Unable to update pin.',
      })
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#050505',
        color: '#e2e8f0',
        fontFamily: "'Inter', sans-serif",
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      <TerrainBackground />

      <aside
        style={{
          width: '280px',
          background: 'rgba(11, 14, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            padding: '0 24px 24px',
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#f59e0b',
            fontSize: '1.1rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '20px',
          }}
        >
          QUANTUM
        </div>

        <div style={{ padding: '0 12px', marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: '#718096',
              paddingLeft: '12px',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            Main
          </div>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '6px', color: '#718096', textDecoration: 'none' }}>
            Landing
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '6px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', borderLeft: '3px solid #f59e0b', fontWeight: 500 }}>
            Workspace
          </div>
          <Link to="/team" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '6px', color: '#718096', textDecoration: 'none' }}>
            Team
          </Link>
        </div>

        <div style={{ padding: '0 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingInline: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#718096', fontWeight: 600 }}>
              Personal Workspaces
            </div>
            <button
              type="button"
              onClick={() => {
                void handleCreateWorkspace()
              }}
              style={{ border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
              title="Create personal workspace"
            >
              +
            </button>
          </div>
          <div>
            {workspaces.map((workspace) => {
              const active = workspace.id === selectedWorkspaceId
              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(workspace.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '6px',
                    color: active ? '#f59e0b' : '#cbd5e1',
                    background: active ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    border: active ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid transparent',
                    textAlign: 'left',
                  }}
                >
                  <span>{workspace.name}</span>
                  <span style={{ color: '#718096', fontSize: '12px' }}>{workspace.pinnedMissionIds.length} pinned</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: '24px', padding: '0 24px', color: '#718096', fontSize: '12px', lineHeight: 1.5 }}>
          Personal workspaces are fully editable by their owner. Team copies stay shareable without giving away edit access.
        </div>

        <button
          type="button"
          onClick={() => {
            void logout()
          }}
          style={{
            marginTop: 'auto',
            marginInline: '24px',
            padding: '10px 16px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: '#e2e8f0',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 5 }}>
        <header
          style={{
            height: '70px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            background: 'rgba(11, 14, 20, 0.6)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ fontSize: '14px', color: '#718096' }}>
            Workspaces / <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{selectedWorkspace?.name ?? 'Workspace'}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate('/team')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.05)',
                color: '#e2e8f0',
                cursor: 'pointer',
              }}
            >
              Team Area
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCreateMission()
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                border: '1px solid transparent',
                background: '#f59e0b',
                color: '#000',
                cursor: 'pointer',
                boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)',
              }}
            >
              {creating ? 'Creating...' : 'New Mission'}
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 600 }}>{selectedWorkspace?.name ?? 'Workspace'}</h1>
              <div style={{ color: '#718096', fontSize: '14px', marginTop: '4px' }}>
                {missions.length} missions, {(selectedWorkspace?.pinnedMissionIds ?? []).length} pinned
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: '#718096', padding: '40px 0' }}>Loading missions...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {sortedMissions.map((mission) => {
                const isPinned = selectedWorkspace?.pinnedMissionIds.includes(mission.id) ?? false
                const isOwner = mission.ownerId === user?.uid

                return (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => navigate(`/workspace/${mission.id}`)}
                    style={{
                      background: 'rgba(21, 25, 34, 0.6)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${isPinned ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '8px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, border-color 0.2s, background 0.2s',
                      position: 'relative',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: '#e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#718096', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {mission.id}
                        </span>
                        {isPinned ? (
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b' }}>
                            Pinned
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          const rect = event.currentTarget.getBoundingClientRect()
                          setMenu({
                            mission,
                            x: rect.left - 170,
                            y: rect.bottom + 5,
                          })
                        }}
                        style={{ background: 'none', border: 'none', color: '#718096', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                      >
                        ...
                      </button>
                    </div>

                    <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '6px' }}>{mission.title}</div>
                    <div style={{ fontSize: '12px', color: '#718096', marginBottom: '12px' }}>
                      Modified {formatRelativeTime(mission.lastModified)}
                    </div>
                    <div style={{ fontSize: '12px', color: isOwner ? '#34d399' : '#94a3b8', marginBottom: '16px' }}>
                      {isOwner ? 'Editable by you' : 'Read-only here, duplicate to edit'}
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 500, background: mission.status === 'published' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)', color: mission.status === 'published' ? '#34d399' : '#718096' }}>
                        {mission.status.toUpperCase()}
                      </span>
                      {mission.duplicatedFrom ? (
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 500, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                          Copied from {mission.duplicatedFrom}
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {menu ? (
        <div
          style={{
            position: 'fixed',
            top: menu.y,
            left: menu.x,
            background: 'rgba(21, 25, 34, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            width: '190px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '4px',
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => navigate(`/workspace/${menu.mission.id}`)} style={{ padding: '8px 12px', fontSize: '13px', color: '#e2e8f0', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
            Open Simulator
          </button>
          <button
            type="button"
            onClick={() => {
              void handleTogglePin(menu.mission)
              setMenu(null)
            }}
            style={{ padding: '8px 12px', fontSize: '13px', color: '#e2e8f0', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            {(selectedWorkspace?.pinnedMissionIds ?? []).includes(menu.mission.id) ? 'Unpin' : 'Pin'} Mission
          </button>
          <button
            type="button"
            onClick={() => {
              setShareState({ mission: menu.mission })
              setMenu(null)
            }}
            style={{ padding: '8px 12px', fontSize: '13px', color: '#e2e8f0', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            Copy to Team
          </button>
          <button
            type="button"
            onClick={() => {
              void handleDuplicate(menu.mission)
              setMenu(null)
            }}
            style={{ padding: '8px 12px', fontSize: '13px', color: '#e2e8f0', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            Duplicate to Personal
          </button>
          {menu.mission.ownerId === user?.uid ? (
            <>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={() => {
                  void handleDelete(menu.mission)
                  setMenu(null)
                }}
                style={{ padding: '8px 12px', fontSize: '13px', color: '#f87171', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {shareState ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShareState(null)}
        >
          <div
            style={{
              background: 'rgba(21, 25, 34, 0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>Copy to Team Workspace</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '18px' }}>
              This creates a new editable copy you own inside the selected team workspace.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {teamWorkspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => {
                    void handleDuplicate(shareState.mission, workspace.id)
                    setShareState(null)
                  }}
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(30, 38, 48, 0.85)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#e2e8f0',
                    textAlign: 'left',
                  }}
                >
                  {workspace.name}
                </button>
              ))}
              {teamWorkspaces.length === 0 ? (
                <div style={{ color: '#718096', fontSize: '13px' }}>No team workspaces available yet. Create one in the Team area.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(21, 25, 34, 0.95)',
            border: `1px solid ${toast.tone === 'danger' ? '#ef4444' : toast.tone === 'success' ? '#10b981' : '#f59e0b'}`,
            padding: '12px 20px',
            borderRadius: '6px',
            color: '#e2e8f0',
            fontSize: '13px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
            zIndex: 200,
          }}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
