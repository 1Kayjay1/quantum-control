import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'

import { useAuth } from '../hooks/useAuth'

interface ParticleState {
  velocity: THREE.Vector3
  originalPos: THREE.Vector3
}

function getParticleState(mesh: THREE.Mesh): ParticleState {
  return mesh.userData as ParticleState
}

export function GhostlineLandingPage() {
  const { user, logout, isAuthenticated } = useAuth()
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [activeFeature, setActiveFeature] = useState<number | null>(null)

  useEffect(() => {
    const container = canvasRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x020408, 0.015)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.z = 8

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Ghostline color palette - cyan/teal accent
    const ghostlinePrimary = 0x06b6d4
    const ghostlineSecondary = 0x0891b2
    const ghostlineAccent = 0x22d3ee

    // Create floating trajectory particles
    const particleCount = 200
    const particles: THREE.Mesh[] = []

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.02 + Math.random() * 0.03, 8, 8)
      const material = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.7 ? ghostlineAccent : ghostlinePrimary,
        transparent: true,
        opacity: 0.4 + Math.random() * 0.4,
      })
      const particle = new THREE.Mesh(geometry, material)
      particle.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 15
      )
      particle.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.005
        ),
        originalPos: particle.position.clone(),
      }
      scene.add(particle)
      particles.push(particle)
    }

    // Create trajectory lines (ghost trails)
    const lineGroup = new THREE.Group()
    for (let i = 0; i < 15; i++) {
      const points: THREE.Vector3[] = []
      const startX = (Math.random() - 0.5) * 16
      const startY = (Math.random() - 0.5) * 16
      const startZ = (Math.random() - 0.5) * 10

      for (let j = 0; j < 50; j++) {
        points.push(new THREE.Vector3(
          startX + Math.sin(j * 0.2) * 2 + j * 0.05,
          startY + Math.cos(j * 0.15) * 1.5 + j * 0.03,
          startZ + Math.sin(j * 0.1) * 0.5
        ))
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({
        color: ghostlineSecondary,
        transparent: true,
        opacity: 0.15,
      })
      lineGroup.add(new THREE.Line(geometry, material))
    }
    scene.add(lineGroup)

    // Checkpoint rings
    const checkpointGroup = new THREE.Group()
    for (let i = 0; i < 8; i++) {
      const ringGeo = new THREE.TorusGeometry(0.3 + Math.random() * 0.2, 0.02, 8, 32)
      const ringMat = new THREE.MeshBasicMaterial({
        color: ghostlineAccent,
        transparent: true,
        opacity: 0.3,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 8
      )
      ring.rotation.x = Math.random() * Math.PI
      ring.rotation.y = Math.random() * Math.PI
      checkpointGroup.add(ring)
    }
    scene.add(checkpointGroup)

    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) * 0.0008
      mouseY = (event.clientY - window.innerHeight / 2) * 0.0008
    }

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    const clock = new THREE.Clock()
    let animationFrame = 0

    const animate = () => {
      animationFrame = requestAnimationFrame(animate)
      const time = clock.getElapsedTime()

      targetX += (mouseX - targetX) * 0.02
      targetY += (mouseY - targetY) * 0.02

      camera.position.x = targetX * 3
      camera.position.y = targetY * 3
      camera.lookAt(0, 0, 0)

      particles.forEach((particle) => {
        const state = getParticleState(particle)
        particle.position.x = state.originalPos.x + Math.sin(time + state.originalPos.x) * 0.3
        particle.position.y = state.originalPos.y + Math.cos(time * 0.8 + state.originalPos.y) * 0.3
        particle.position.z = state.originalPos.z + Math.sin(time * 0.5) * 0.2
      })

      checkpointGroup.children.forEach((ring, i) => {
        ring.rotation.x += 0.002
        ring.rotation.z += 0.001
        const mesh = ring as THREE.Mesh
        const mat = mesh.material as THREE.MeshBasicMaterial
        mat.opacity = 0.2 + Math.sin(time * 2 + i) * 0.15
      })

      lineGroup.rotation.y = time * 0.02

      renderer.render(scene, camera)
    }

    document.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', handleResize)
    animate()

    return () => {
      cancelAnimationFrame(animationFrame)
      document.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  const features = [
    {
      icon: '◈',
      title: 'Teach Mode',
      description: 'Fly the route manually. The system captures every input, every sensor reading, every state change at a fixed sample rate.',
    },
    {
      icon: '◎',
      title: 'Checkpoint System',
      description: 'Mark critical positions from your recorded flight. Define tolerances, heading constraints, and speed requirements.',
    },
    {
      icon: '⟳',
      title: 'Iterative Optimizer',
      description: 'Start from your taught baseline. Make bounded, smart edits. Keep what works. Improve what doesn\'t. Never throw away the champion.',
    },
    {
      icon: '⬡',
      title: 'Elite Memory',
      description: 'Persist best runs, elite candidates, and optimizer state across battery swaps, app restarts, and session boundaries.',
    },
    {
      icon: '▣',
      title: 'Safety Layer',
      description: 'Real-time monitoring for obstacles, bounds, attitude, battery, and sensor health. Conservative guardrails for unattended loops.',
    },
    {
      icon: '▦',
      title: 'Obsessive Logging',
      description: 'Every run logged. Every checkpoint result captured. Every abort reason recorded. Diff and inspect runs side by side.',
    },
  ]

  return (
    <div
      style={{
        backgroundColor: '#020408',
        color: '#e2e8f0',
        fontFamily: "'Inter', sans-serif",
        overflowX: 'hidden',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      {/* Three.js canvas background */}
      <div
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 30%, rgba(6, 182, 212, 0.08) 0%, rgba(2, 4, 8, 0) 60%)',
        }}
      />

      {/* Navigation */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          padding: '20px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
          backdropFilter: 'blur(12px)',
          background: 'linear-gradient(to bottom, rgba(2, 4, 8, 0.8), transparent)',
          borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: '1.1rem',
            letterSpacing: '-0.02em',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span style={{ color: '#06b6d4' }}>GHOST</span>LINE
        </Link>

        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <Link to="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', transition: 'color 0.2s' }}>
            Quantum Control
          </Link>
          <Link to={isAuthenticated ? '/ghostline/workspace' : '/login'} style={{ color: '#06b6d4', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>
            Launch
          </Link>
          {!user ? (
            <Link
              to="/login"
              style={{
                padding: '8px 20px',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '6px',
                color: '#06b6d4',
                textDecoration: 'none',
                fontSize: '0.85rem',
                background: 'rgba(6, 182, 212, 0.05)',
                transition: 'all 0.2s',
              }}
            >
              Sign In
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void logout()}
              style={{
                padding: '8px 20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#94a3b8',
                fontSize: '0.85rem',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Sign Out
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section
        style={{
          padding: '0 10%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: '15vh',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            color: '#06b6d4',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          CoDrone EDU Route Optimizer
        </div>
        <h1
          style={{
            fontSize: 'clamp(2.5rem, 7vw, 5rem)',
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '24px',
            color: '#ffffff',
          }}
        >
          Teach. Refine.
          <br />
          <span style={{ color: '#06b6d4' }}>Repeat.</span>
        </h1>
        <p
          style={{
            fontSize: '1.1rem',
            color: '#94a3b8',
            maxWidth: '540px',
            marginBottom: '40px',
            lineHeight: 1.7,
          }}
        >
          A deterministic, iterative optimizer for CoDrone EDU autonomous routes.
          Start from a human-taught baseline. Keep editing the champion until it's perfect.
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Link
            to={isAuthenticated ? '/ghostline/workspace' : '/login'}
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              color: '#020408',
              padding: '14px 28px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              boxShadow: '0 0 30px rgba(6, 182, 212, 0.3)',
              transition: 'all 0.2s',
            }}
          >
            Open Workspace
          </Link>
          <Link
            to="/"
            style={{
              background: 'transparent',
              color: '#94a3b8',
              padding: '14px 28px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '0.95rem',
              transition: 'all 0.2s',
            }}
          >
            Back to Quantum Control
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section
        style={{
          padding: '0 10% 120px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: '60px',
          }}
        >
          <h2 style={{ fontSize: '2rem', marginBottom: '12px', fontWeight: 700 }}>
            Built for Iteration
          </h2>
          <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>
            Not AI guessing from zero. Not random search. Real engineering refinement from your taught baseline.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {features.map((feature, index) => (
            <div
              key={feature.title}
              onMouseEnter={() => setActiveFeature(index)}
              onMouseLeave={() => setActiveFeature(null)}
              style={{
                background: activeFeature === index ? 'rgba(6, 182, 212, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${activeFeature === index ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
                padding: '28px',
                borderRadius: '12px',
                transition: 'all 0.3s ease',
                cursor: 'default',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#06b6d4' }}>
                {feature.icon}
              </div>
              <h3 style={{ marginBottom: '10px', fontSize: '1.1rem', fontWeight: 600 }}>
                {feature.title}
              </h3>
              <p style={{ color: '#64748b', lineHeight: 1.6, fontSize: '0.9rem' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section
        style={{
          padding: '80px 10%',
          background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.03) 0%, transparent 100%)',
          borderTop: '1px solid rgba(6, 182, 212, 0.1)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h2 style={{ fontSize: '1.75rem', marginBottom: '48px', textAlign: 'center', fontWeight: 700 }}>
          The Workflow
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '32px',
            maxWidth: '900px',
            margin: '0 auto',
          }}
        >
          {[
            { step: '01', title: 'Teach', desc: 'Fly the route manually. System records everything.' },
            { step: '02', title: 'Mark', desc: 'Define checkpoints from recorded positions.' },
            { step: '03', title: 'Replay', desc: 'Execute the baseline autonomously.' },
            { step: '04', title: 'Refine', desc: 'Iterate. Keep the champion. Improve forever.' },
          ].map((item, i) => (
            <div key={item.step} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  color: '#06b6d4',
                  marginBottom: '12px',
                  letterSpacing: '0.1em',
                }}
              >
                {item.step}
              </div>
              <h3 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>{item.title}</h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5 }}>{item.desc}</p>
              {i < 3 && (
                <div
                  style={{
                    display: 'none',
                    color: '#475569',
                    fontSize: '1.2rem',
                  }}
                  className="ghostline-workflow-arrow"
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '32px 10%',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#475569',
          fontSize: '0.8rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div>CoDrone EDU Route Optimizer — Ghostline</div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Quantum Control
          </Link>
          <span style={{ color: '#06b6d4' }}>Ghostline</span>
        </div>
      </footer>
    </div>
  )
}