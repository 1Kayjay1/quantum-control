import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as THREE from 'three'

import { useAuth } from '../hooks/useAuth'

const pageStyle: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  width: '100%',
  overflow: 'hidden',
  background: '#050505',
  color: '#ffffff',
  fontFamily: "'Inter', sans-serif",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
}

const cardStyle: CSSProperties = {
  background: 'rgba(20, 20, 25, 0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '16px',
  padding: '40px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
  width: '100%',
  maxWidth: '440px',
}

function AuthBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050505, 0.02)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const knotGeometry = new THREE.TorusKnotGeometry(1.75, 0.38, 180, 24)
    const knotMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    })
    const torusKnot = new THREE.Mesh(knotGeometry, knotMaterial)
    scene.add(torusKnot)

    const particlesGeometry = new THREE.BufferGeometry()
    const particleCount = 1700
    const positions = new Float32Array(particleCount * 3)

    for (let index = 0; index < particleCount * 3; index += 1) {
      positions[index] = (Math.random() - 0.5) * 24
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.028,
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    })
    const particles = new THREE.Points(particlesGeometry, particlesMaterial)
    scene.add(particles)

    const clock = new THREE.Clock()
    let mouseX = 0
    let mouseY = 0

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX - window.innerWidth / 2
      mouseY = event.clientY - window.innerHeight / 2
    }

    const animate = () => {
      const elapsed = clock.getElapsedTime()

      torusKnot.rotation.x = elapsed * 0.12
      torusKnot.rotation.y = elapsed * 0.18
      particles.rotation.y = -elapsed * 0.045

      const targetX = mouseX * 0.001
      const targetY = mouseY * 0.001

      torusKnot.rotation.y += 0.04 * (targetX - torusKnot.rotation.y)
      torusKnot.rotation.x += 0.04 * (targetY - torusKnot.rotation.x)
      particles.position.x += 0.04 * (targetX * 2 - particles.position.x)
      particles.position.y += 0.04 * (-targetY * 2 - particles.position.y)

      renderer.render(scene, camera)
    }

    renderer.setAnimationLoop(animate)
    window.addEventListener('mousemove', handleMouseMove)

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      renderer.setAnimationLoop(null)
      container.removeChild(renderer.domElement)
      knotGeometry.dispose()
      knotMaterial.dispose()
      particlesGeometry.dispose()
      particlesMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} aria-hidden="true" />
}

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signup(email, password, displayName)
      navigate('/workspace')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <AuthBackground />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px' }}>
        <div
          style={{
            ...cardStyle,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 1.2s ease, transform 1.2s ease',
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', color: '#ffffff', textDecoration: 'none' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#f59e0b' }}>
              <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z" />
            </svg>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
              QUANTUM CONTROL
            </span>
          </Link>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>Create account</h1>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '32px' }}>
            Request access to the flight deck and provision your operator profile.
          </p>

          {error ? (
            <div style={{ marginBottom: '20px', borderRadius: '10px', border: '1px solid rgba(248, 113, 113, 0.35)', background: 'rgba(127, 29, 29, 0.28)', color: '#fecaca', padding: '12px 14px', fontSize: '0.9rem' }}>
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Display Name
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '12px', color: '#94a3b8', pointerEvents: 'none', fontSize: '0.95rem' }}>+</div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Operator name"
                  required
                  style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '12px 12px 12px 40px', color: '#ffffff', fontFamily: "'Inter', sans-serif", fontSize: '0.95rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email Address
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '12px', color: '#94a3b8', pointerEvents: 'none', fontSize: '0.95rem' }}>@</div>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="pilot@quantum.control"
                  required
                  style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '12px 12px 12px 40px', color: '#ffffff', fontFamily: "'Inter', sans-serif", fontSize: '0.95rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '12px', color: '#94a3b8', pointerEvents: 'none', fontSize: '0.95rem' }}>#</div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '12px 48px 12px 40px', color: '#ffffff', fontFamily: "'Inter', sans-serif", fontSize: '0.95rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  style={{ position: 'absolute', right: '12px', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p style={{ marginTop: '8px', color: '#718096', fontSize: '0.78rem' }}>
                Access may require approval depending on your assigned tier.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '14px', background: '#f59e0b', color: '#000000', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px', boxShadow: loading ? 'none' : '0 0 20px rgba(245, 158, 11, 0.2)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Provisioning...' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <Link to="/login" style={{ color: '#94a3b8', textDecoration: 'none' }}>
              Already have an account?
            </Link>
            <Link to="/login" style={{ color: '#f59e0b', textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
