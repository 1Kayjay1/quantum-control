import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'

import { useAuth } from '../hooks/useAuth'

interface DroneMotionState {
  initialPos: THREE.Vector3
  randomOffset: number
  ring1: THREE.Mesh
  ring2: THREE.Mesh
  speed: number
}

function getDroneState(group: THREE.Group) {
  return group.userData as DroneMotionState
}

export function LandingPage() {
  const { user, logout, isAuthenticated } = useAuth()
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050505, 0.035)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0x404040, 2)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0xffffff, 2, 50)
    pointLight.position.set(0, 0, 5)
    scene.add(pointLight)

    const createDroneMesh = () => {
      const group = new THREE.Group()

      const coreGeo = new THREE.OctahedronGeometry(0.1, 0)
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
      group.add(new THREE.Mesh(coreGeo, coreMat))

      const ringGeo = new THREE.TorusGeometry(0.2, 0.01, 8, 32)
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 })
      const ring1 = new THREE.Mesh(ringGeo, ringMat)
      const ring2 = new THREE.Mesh(ringGeo, ringMat)
      ring2.rotation.x = Math.PI / 2
      group.add(ring1)
      group.add(ring2)

      const glowGeo = new THREE.SphereGeometry(0.05, 8, 8)
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      const glow = new THREE.Mesh(glowGeo, glowMat)
      glow.position.z = 0.1
      group.add(glow)

      group.userData = {
        ring1,
        ring2,
        speed: Math.random() * 0.05 + 0.02,
        initialPos: new THREE.Vector3(),
        randomOffset: Math.random() * 100,
      } satisfies DroneMotionState

      return group
    }

    const droneGroup = new THREE.Group()
    const drones: THREE.Group[] = []

    for (let index = 0; index < 40; index += 1) {
      const drone = createDroneMesh()
      drone.position.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10)
      drone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      getDroneState(drone).initialPos = drone.position.clone()
      droneGroup.add(drone)
      drones.push(drone)
    }

    scene.add(droneGroup)

    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0
    let scrollY = window.scrollY

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) * 0.001
      mouseY = (event.clientY - window.innerHeight / 2) * 0.001
    }

    const handleScroll = () => {
      scrollY = window.scrollY
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
      targetX = mouseX * 0.5
      targetY = mouseY * 0.5

      const scrollHeight = Math.max(document.body.scrollHeight - window.innerHeight, 1)
      const scrollProgress = scrollY / scrollHeight
      const scrollRotationY = scrollProgress * Math.PI * 0.5
      const scrollRotationX = scrollProgress * 0.35

      droneGroup.rotation.y += 0.05 * (scrollRotationY + targetX - droneGroup.rotation.y)
      droneGroup.rotation.x += 0.05 * (scrollRotationX + targetY - droneGroup.rotation.x)
      camera.position.z = 5 - scrollProgress * 7
      camera.position.y = scrollProgress * 1.4

      drones.forEach((drone) => {
        const state = getDroneState(drone)
        drone.position.y = state.initialPos.y + Math.sin(time + state.randomOffset) * 0.2
        state.ring1.rotation.z += state.speed
        state.ring2.rotation.x += state.speed
        drone.scale.setScalar(1 + Math.sin(time * 2 + state.randomOffset) * 0.1)
      })

      renderer.render(scene, camera)
    }

    document.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)
    animate()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const title = document.querySelector('.animate-title') as HTMLElement | null
    const subtitle = document.querySelector('.animate-subtitle') as HTMLElement | null
    const buttons = document.querySelector('.animate-btns') as HTMLElement | null
    const cards = document.querySelectorAll<HTMLElement>('.card')

    const animateIn = (element: HTMLElement | null, translateY: number, delay: number) => {
      if (!element) {
        return
      }

      element.style.opacity = '0'
      element.style.transform = `translateY(${translateY}px)`
      window.setTimeout(() => {
        element.style.transition = 'all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        element.style.opacity = '1'
        element.style.transform = 'translateY(0)'
      }, delay)
    }

    animateIn(title, 100, 100)
    animateIn(subtitle, 50, 400)
    animateIn(buttons, 50, 700)

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (!entry.isIntersecting) {
          return
        }

        const card = entry.target as HTMLElement
        window.setTimeout(() => {
          card.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          card.style.opacity = '1'
          card.style.transform = 'translateY(0)'
        }, index * 200)
      })
    }, { threshold: 0.1 })

    cards.forEach((card) => {
      card.style.opacity = '0'
      card.style.transform = 'translateY(100px)'
      observer.observe(card)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div
      style={{
        backgroundColor: '#050505',
        color: '#ffffff',
        fontFamily: "'Inter', sans-serif",
        overflowX: 'hidden',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      <div
        ref={canvasContainerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 50%, rgba(5,5,5,0) 0%, rgba(5,5,5,0.8) 80%, #050505 100%)',
        }}
      />

      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          padding: '24px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
          backdropFilter: 'blur(10px)',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: '1.2rem',
            letterSpacing: '-0.02em',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z" />
          </svg>
          QUANTUM <span style={{ color: '#f59e0b' }}>CONTROL</span>
        </Link>

        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
          <Link to={isAuthenticated ? '/workspace' : '/login'} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
            Workspace
          </Link>
          <Link to={isAuthenticated ? '/team' : '/login'} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
            Team
          </Link>
          {!user ? (
            <Link
              to="/login"
              style={{
                padding: '10px 24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '100px',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '0.9rem',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              Sign In
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                void logout()
              }}
              style={{
                padding: '10px 24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '100px',
                color: '#ffffff',
                fontSize: '0.9rem',
                background: 'rgba(255, 255, 255, 0.03)',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          )}
        </div>
      </nav>

      {user && !isAuthenticated ? (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99,
            width: '90%',
            maxWidth: '600px',
          }}
        >
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
            }}
          >
            <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#f59e0b' }}>Account Pending Approval</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
              Your account is awaiting approval from an administrator. You’ll receive access to the workspace once approved.
            </p>
          </div>
        </div>
      ) : null}

      <section
        style={{
          padding: '0 10%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: '20vh',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h1
          className="animate-title"
          style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '24px',
            background: 'linear-gradient(to right, #fff 20%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          The Future of
          <br />
          Autonomous Flight.
        </h1>
        <p
          className="animate-subtitle"
          style={{
            fontSize: '1.2rem',
            color: '#94a3b8',
            maxWidth: '600px',
            marginBottom: '40px',
            lineHeight: 1.6,
          }}
        >
          Design, simulate, and deploy drone missions with physics-grade precision. The ultimate professional ground control station.
        </p>
        <div className="animate-btns" style={{ display: 'flex', gap: '20px' }}>
          <Link
            to={isAuthenticated ? '/workspace' : '/login'}
            style={{
              background: '#f59e0b',
              color: '#000',
              padding: '16px 32px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Launch Workspace
          </Link>
          <Link
            to={isAuthenticated ? '/team' : '/signup'}
            style={{
              background: 'transparent',
              color: '#ffffff',
              padding: '16px 32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            View Documentation
          </Link>
        </div>
      </section>

      <section
        style={{
          padding: '0 10%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h2 style={{ fontSize: '2.5rem', marginBottom: '60px' }}>Engineered for Precision</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px',
            width: '100%',
          }}
        >
          {[
            ['PHYSICS', 'Real-time Dynamics', 'Built on a custom physics engine. Simulate wind, drag, inertia, and payload variations accurately.'],
            ['SWARM', 'Fleet Management', 'Control single units or coordinate swarms of hundreds of drones with our intuitive timeline sequencer.'],
            ['CODE', 'Developer First', 'Full API access. Script complex behaviors in Python or JavaScript directly in the browser.'],
          ].map(([label, title, copy]) => (
            <div
              key={label}
              className="card"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '40px',
                borderRadius: '12px',
                textAlign: 'left',
                backdropFilter: 'blur(5px)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '20px', color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>
                {label}
              </div>
              <h3 style={{ marginBottom: '10px', fontSize: '1.25rem' }}>{title}</h3>
              <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          padding: '0 10%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: '500px' }}>
          <h2 style={{ fontSize: '3rem', marginBottom: '20px' }}>
            Built by Engineers,
            <br />
            for Engineers.
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '30px', fontSize: '1.1rem' }}>
            We are a distributed team of aerospace and software veterans dedicated to democratizing autonomous flight technology.
          </p>
          <Link
            to={isAuthenticated ? '/team' : '/signup'}
            style={{
              background: 'transparent',
              color: '#ffffff',
              padding: '16px 32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Meet the Team
          </Link>
        </div>
      </section>

      <footer
        style={{
          padding: '40px 10%',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#94a3b8',
          fontSize: '0.9rem',
          background: '#020202',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div>&copy; 2023 Quantum Control Systems.</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</a>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Contact</a>
        </div>
      </footer>
    </div>
  )
}
