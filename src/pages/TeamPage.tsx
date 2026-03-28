import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as THREE from 'three'

import { useAuth } from '../hooks/useAuth'
import { workspaceService } from '../services/workspaceService'
import type { Mission } from '../types/mission'
import type { Workspace } from '../types/workspace'

interface TeamDescriptor {
  id: string
  name: string
  description: string
  members: number
  creator: string
  createdLabel: string
}

interface ShareState {
  mission: Mission
}

function formatAge(value: Date) {
  const minutes = Math.max(1, Math.floor((Date.now() - value.getTime()) / 60000))
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    return `${days}d ago`
  }

  return `${Math.floor(days / 30)}mo ago`
}

function formatCreated(value: Date) {
  return value.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function buildTeamDescription(workspace: Workspace) {
  if (workspace.name.toLowerCase().includes('rescue')) {
    return 'Coordinating autonomous drone fleets for disaster relief scenarios.'
  }
  if (workspace.name.toLowerCase().includes('engineer')) {
    return 'Testing propulsion systems and obstacle avoidance in shared mission loops.'
  }
  if (workspace.name.toLowerCase().includes('race')) {
    return 'High-speed track design, timing analysis, and pilot training simulations.'
  }
  return 'Shared team workspace for mission design, duplication, and simulator review.'
}

function TeamNetworkBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050505, 0.02)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 50

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const particleCount = 100
    const particles = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 0.05,
      y: (Math.random() - 0.5) * 0.05,
      z: (Math.random() - 0.5) * 0.05,
    }))

    for (let index = 0; index < particleCount; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 100
      positions[index * 3 + 1] = (Math.random() - 0.5) * 60
      positions[index * 3 + 2] = (Math.random() - 0.5) * 50
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x3b82f6,
      size: 0.5,
      transparent: true,
      opacity: 0.4,
    })
    const particleSystem = new THREE.Points(particles, particleMaterial)
    scene.add(particleSystem)

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.15,
    })
    const lineGeometry = new THREE.BufferGeometry()
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lines)

    let mouseX = 0
    let mouseY = 0

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) * 0.05
      mouseY = (event.clientY - window.innerHeight / 2) * 0.05
    }

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    let animationFrame = 0
    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate)

      const positionArray = particleSystem.geometry.attributes.position.array as Float32Array
      for (let index = 0; index < particleCount; index += 1) {
        positionArray[index * 3] += velocities[index].x
        positionArray[index * 3 + 1] += velocities[index].y
        positionArray[index * 3 + 2] += velocities[index].z

        if (Math.abs(positionArray[index * 3]) > 50) velocities[index].x *= -1
        if (Math.abs(positionArray[index * 3 + 1]) > 30) velocities[index].y *= -1
        if (Math.abs(positionArray[index * 3 + 2]) > 25) velocities[index].z *= -1
      }
      particleSystem.geometry.attributes.position.needsUpdate = true

      const linePositions: number[] = []
      for (let left = 0; left < particleCount; left += 1) {
        for (let right = left + 1; right < particleCount; right += 1) {
          const dx = positionArray[left * 3] - positionArray[right * 3]
          const dy = positionArray[left * 3 + 1] - positionArray[right * 3 + 1]
          const dz = positionArray[left * 3 + 2] - positionArray[right * 3 + 2]
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

          if (distance < 15) {
            linePositions.push(
              positionArray[left * 3],
              positionArray[left * 3 + 1],
              positionArray[left * 3 + 2],
              positionArray[right * 3],
              positionArray[right * 3 + 1],
              positionArray[right * 3 + 2],
            )
          }
        }
      }

      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
      camera.position.x += (mouseX - camera.position.x) * 0.02
      camera.position.y += (-mouseY - camera.position.y) * 0.02
      camera.lookAt(scene.position)

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
      particles.dispose()
      particleMaterial.dispose()
      lineGeometry.dispose()
      lineMaterial.dispose()
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
        background: 'radial-gradient(circle at center, rgba(5,5,5,0.4) 0%, rgba(5,5,5,0.95) 85%)',
      }}
    />
  )
}

function MissionPathPreview({ mission }: { mission: Mission }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    context.scale(dpr, dpr)
    const width = rect.width
    const height = rect.height

    context.clearRect(0, 0, width, height)
    context.strokeStyle = '#1e2530'
    context.lineWidth = 1
    context.beginPath()
    for (let x = 0; x < width; x += 20) {
      context.moveTo(x, 0)
      context.lineTo(x, height)
    }
    for (let y = 0; y < height; y += 20) {
      context.moveTo(0, y)
      context.lineTo(width, y)
    }
    context.stroke()

    const routeCount = Math.max(1, mission.data.routeVersions?.length ?? 1)
    const seed = mission.id.length + routeCount
    const type = seed % 3

    const points: Array<{ x: number; y: number }> = [{ x: 20, y: height / 2 }]
    if (type === 0) {
      let x = 20
      for (let index = 0; index < 4; index += 1) {
        x += 30
        points.push({ x, y: height / 2 - 30 })
        x += 30
        points.push({ x, y: height / 2 + 30 })
      }
    } else if (type === 1) {
      let x = 20
      for (let index = 0; index < 6; index += 1) {
        x += 25
        points.push({ x, y: index % 2 === 0 ? height - 20 : 20 })
      }
    } else {
      points.push({ x: width / 2, y: 20 })
      points.push({ x: width - 20, y: height - 20 })
      points.push({ x: 20, y: height - 20 })
      points.push({ x: width / 2, y: 20 })
    }

    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y)
    }
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2
    context.strokeStyle = mission.status === 'published' ? '#10b981' : '#ef4444'
    context.shadowBlur = 5
    context.shadowColor = context.strokeStyle
    context.stroke()

    context.shadowBlur = 0
    context.fillStyle = '#ffffff'
    points.forEach((point, index) => {
      if (index % 2 === 0) {
        context.beginPath()
        context.arc(point.x, point.y, 2, 0, Math.PI * 2)
        context.fill()
      }
    })
  }, [mission])

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
}

export function TeamPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [personalWorkspace, setPersonalWorkspace] = useState<Workspace | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [creatingMission, setCreatingMission] = useState(false)
  const [shareState, setShareState] = useState<ShareState | null>(null)

  const loadChrome = useCallback(async (preferredWorkspaceId?: string | null) => {
    const [teamWorkspaces, personal] = await Promise.all([
      workspaceService.getTeamWorkspaces(),
      workspaceService.getDefaultPersonalWorkspace(),
    ])

    setWorkspaces(teamWorkspaces)
    setPersonalWorkspace(personal)

    const nextWorkspaceId = preferredWorkspaceId ?? selectedWorkspaceId ?? null
    if (nextWorkspaceId) {
      setSelectedWorkspaceId(nextWorkspaceId)
    }
  }, [selectedWorkspaceId])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        await loadChrome()
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
  }, [loadChrome])

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setMissions([])
      return
    }

    let cancelled = false
    const loadMissions = async () => {
      const missionList = await workspaceService.getMissions(selectedWorkspaceId)
      if (!cancelled) {
        setMissions(missionList)
      }
    }

    void loadMissions()
    return () => {
      cancelled = true
    }
  }, [selectedWorkspaceId])

  const teamDescriptors = useMemo<TeamDescriptor[]>(() => {
    return workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      description: buildTeamDescription(workspace),
      members: Math.max(workspace.members.length, 1),
      creator: workspace.ownerId.slice(0, 8),
      createdLabel: formatCreated(workspace.createdAt),
    }))
  }, [workspaces])

  const selectedTeam = teamDescriptors.find((team) => team.id === selectedWorkspaceId) ?? null

  const handleCreateTeamWorkspace = async () => {
    if (creatingWorkspace) {
      return
    }

    const name = window.prompt('Name your team workspace', `Team Workspace ${workspaces.length + 1}`)
    if (!name) {
      return
    }

    setCreatingWorkspace(true)
    try {
      const workspace = await workspaceService.createWorkspace(name, 'team')
      await loadChrome(workspace.id)
      setSelectedWorkspaceId(workspace.id)
    } finally {
      setCreatingWorkspace(false)
    }
  }

  const handleCreateMission = async () => {
    if (!selectedWorkspaceId || creatingMission) {
      return
    }

    setCreatingMission(true)
    try {
      const mission = await workspaceService.createMission(
        selectedWorkspaceId,
        `Team Mission ${String(missions.length + 1).padStart(2, '0')}`,
      )
      setMissions((current) => [mission, ...current])
      navigate(`/workspace/${mission.id}`)
    } finally {
      setCreatingMission(false)
    }
  }

  const handleDuplicateToPersonal = async (mission: Mission) => {
    if (!personalWorkspace) {
      return
    }

    const duplicate = await workspaceService.duplicateMission(mission.id, personalWorkspace.id)
    navigate(`/workspace/${duplicate.id}`)
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
      <TeamNetworkBackground />

      <aside
        style={{
          width: '280px',
          background: 'rgba(11, 14, 20, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ padding: '0 24px 24px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#f59e0b', fontSize: '1.1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px' }}>
          QUANTUM
        </div>

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px', color: '#718096', textDecoration: 'none' }}>
          Landing
        </Link>
        <Link to="/workspace" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px', color: '#718096', textDecoration: 'none' }}>
          My Workspace
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px', color: '#f59e0b', borderLeft: '3px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
          Team Workspaces
        </div>

        <div style={{ marginTop: '18px', padding: '0 24px' }}>
          <button
            type="button"
            onClick={() => {
              void handleCreateTeamWorkspace()
            }}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.24)', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', cursor: 'pointer' }}
          >
            {creatingWorkspace ? 'Creating...' : 'New Team Workspace'}
          </button>
        </div>

        <div style={{ marginTop: '20px', padding: '0 24px', color: '#718096', fontSize: '12px', lineHeight: 1.5 }}>
          Any active user can create a team workspace and publish mission copies into it. Mission editing still stays with the mission owner.
        </div>

        <button
          type="button"
          onClick={() => {
            void logout()
          }}
          style={{ marginTop: 'auto', marginInline: '24px', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.03)', color: '#e2e8f0', cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 5 }}>
        <header
          style={{
            height: '70px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            background: 'rgba(11, 14, 20, 0.6)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {selectedWorkspaceId ? (
              <button type="button" onClick={() => setSelectedWorkspaceId(null)} style={{ background: 'none', border: 'none', color: '#718096', cursor: 'pointer', fontSize: '18px' }}>
                Back
              </button>
            ) : null}
            <h1 style={{ fontSize: '20px', fontWeight: 600 }}>{selectedTeam ? selectedTeam.name : 'Team Workspaces'}</h1>
          </div>

          {selectedWorkspaceId ? (
            <button
              type="button"
              onClick={() => {
                void handleCreateMission()
              }}
              style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, border: '1px solid transparent', background: '#f59e0b', color: '#000', cursor: 'pointer', boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)' }}
            >
              {creatingMission ? 'Creating...' : 'New Team Mission'}
            </button>
          ) : null}
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {!selectedWorkspaceId ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {(loading ? [] : teamDescriptors).map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(team.id)}
                  style={{ background: 'rgba(21, 25, 34, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '24px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>
                      TM
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '12px', color: '#718096' }}>Est. {team.createdLabel}</div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{team.name}</div>
                  <div style={{ fontSize: '13px', color: '#718096', marginBottom: '20px', lineHeight: 1.5 }}>{team.description}</div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#718096' }}>
                    <span>{team.members} Members</span>
                    <span>Created by {team.creator}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {missions.map((mission) => {
                const isOwner = mission.ownerId === user?.uid

                return (
                  <article
                    key={mission.id}
                    style={{ background: 'rgba(21, 25, 34, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', display: 'flex', gap: '20px', padding: '20px' }}
                  >
                    <div style={{ width: '200px', height: '120px', background: '#000', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, overflow: 'hidden' }}>
                      <MissionPathPreview mission={mission} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#718096', fontSize: '11px' }}>{mission.id}</span>
                          <span style={{ color: mission.status === 'published' ? '#10b981' : '#ef4444', fontSize: '11px', fontWeight: 700 }}>
                            {mission.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 600, margin: '4px 0' }}>{mission.title}</div>
                        <div style={{ fontSize: '12px', color: '#718096' }}>
                          {selectedTeam?.creator} • {formatAge(mission.lastModified)}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#718096', marginTop: '8px' }}>
                          <span>{mission.data.routeVersions.length} routes</span>
                          <span>{mission.data.fieldLayouts.length} layouts</span>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '12px', color: isOwner ? '#34d399' : '#94a3b8' }}>
                          {isOwner ? 'Editable by you' : 'View-only here. Duplicate to your workspace to edit.'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <Link to={`/workspace/${mission.id}`} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', border: '1px solid #f59e0b', color: '#f59e0b', textDecoration: 'none' }}>
                          Open Simulator
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDuplicateToPersonal(mission)
                          }}
                          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                        >
                          Duplicate to My Workspace
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareState({ mission })}
                          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                        >
                          Copy to Team
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {shareState ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={() => setShareState(null)}>
          <div style={{ background: 'rgba(21, 25, 34, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)', width: '420px', padding: '24px', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }} onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>Copy to Team Workspace</h3>
            <p style={{ fontSize: '12px', color: '#718096', marginBottom: '10px' }}>
              Select a team workspace for {shareState.mission.title}. This creates a new copy owned by you.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => {
                    void workspaceService.duplicateMission(shareState.mission.id, workspace.id)
                    setShareState(null)
                  }}
                  style={{ padding: '10px', background: 'rgba(30, 38, 48, 0.85)', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', display: 'flex', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' }}
                >
                  <span>{workspace.name}</span>
                  <span>Copy</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShareState(null)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
