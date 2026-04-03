import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import type { GhostlineSession, Checkpoint, RunRecord } from '../ghostline/types'
import * as ghostlineService from '../ghostline/services/ghostlineService'

type ViewMode = 'overview' | 'teach' | 'checkpoints' | 'replay' | 'optimize' | 'history' | 'settings'

export function GhostlineWorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [activeView, setActiveView] = useState<ViewMode>('overview')
  const [session, setSession] = useState<GhostlineSession | null>(null)
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadSessionData = async () => {
    if (!sessionId) return

    setLoading(true)
    try {
      const [sessionData, checkpointData, runData] = await Promise.all([
        ghostlineService.getSession(sessionId),
        ghostlineService.getCheckpoints(sessionId),
        ghostlineService.getRuns(sessionId, 20),
      ])

      if (!sessionData) {
        navigate('/ghostline/workspace')
        return
      }

      setSession(sessionData)
      setCheckpoints(checkpointData)
      setRuns(runData)
    } catch (error) {
      console.error('Failed to load session data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSessionData()
  }, [sessionId])

  const sessionStats = {
    runsCompleted: session?.totalRuns || 0,
    bestTime: session?.bestTime || null,
    currentBattery: 78,
    status: 'idle' as const,
  }

  const navItems: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◉' },
    { id: 'teach', label: 'Teach Mode', icon: '◈' },
    { id: 'checkpoints', label: 'Checkpoints', icon: '◎' },
    { id: 'replay', label: 'Replay', icon: '▶' },
    { id: 'optimize', label: 'Optimize', icon: '⟳' },
    { id: 'history', label: 'History', icon: '▤' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ]

  return (
    <div
      style={{
        backgroundColor: '#020408',
        color: '#e2e8f0',
        fontFamily: "'Inter', sans-serif",
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: '240px',
          background: 'rgba(6, 10, 16, 0.95)',
          borderRight: '1px solid rgba(6, 182, 212, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '20px 20px 24px',
            borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
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
          <div
            style={{
              fontSize: '0.7rem',
              color: '#475569',
              marginTop: '4px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {session?.name || 'Loading...'}
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          <div
            style={{
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              color: '#475569',
              paddingLeft: '8px',
              marginBottom: '8px',
              fontWeight: 600,
              letterSpacing: '0.1em',
            }}
          >
            Session
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                color: activeView === item.id ? '#06b6d4' : '#94a3b8',
                background: activeView === item.id ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                border: 'none',
                textAlign: 'left',
                fontSize: '0.85rem',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Quick Stats */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid rgba(6, 182, 212, 0.1)',
          }}
        >
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: '#64748b' }}>Battery</span>
              <span style={{ color: sessionStats.currentBattery > 30 ? '#10b981' : '#ef4444' }}>
                {sessionStats.currentBattery}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: '#64748b' }}>Runs</span>
              <span>{sessionStats.runsCompleted}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: '#64748b' }}>Best</span>
              <span style={{ color: '#06b6d4' }}>
                {sessionStats.bestTime ? `${sessionStats.bestTime.toFixed(2)}s` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Back to Sessions */}
        <div style={{ padding: '12px' }}>
          <Link
            to={session ? `/ghostline/workspace/${session.workspaceId}` : '/ghostline/workspace'}
            style={{
              display: 'block',
              padding: '10px 12px',
              borderRadius: '6px',
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '0.8rem',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              transition: 'all 0.15s',
            }}
          >
            ← Back to Sessions
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 5,
        }}
      >
        {/* Header */}
        <header
          style={{
            height: '56px',
            borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            background: 'rgba(6, 10, 16, 0.6)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '1rem', fontWeight: 600 }}>
              {navItems.find((n) => n.id === activeView)?.label || 'Overview'}
            </h1>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                background: sessionStats.status === 'idle' ? 'rgba(100, 116, 139, 0.2)' : 'rgba(6, 182, 212, 0.15)',
                color: sessionStats.status === 'idle' ? '#94a3b8' : '#06b6d4',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {sessionStats.status}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {user ? (
              <button
                type="button"
                onClick={() => void logout()}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            ) : null}
          </div>
        </header>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ color: '#64748b', padding: '40px 0' }}>Loading session data...</div>
          ) : (
            <>
              {activeView === 'overview' && <OverviewContent session={session} runs={runs} checkpoints={checkpoints} />}
              {activeView === 'teach' && <TeachModeContent />}
              {activeView === 'checkpoints' && <CheckpointsContent checkpoints={checkpoints} session={session} onReload={loadSessionData} />}
              {activeView === 'replay' && <ReplayContent session={session} />}
              {activeView === 'optimize' && <OptimizeContent session={session} />}
              {activeView === 'history' && <HistoryContent runs={runs} />}
              {activeView === 'settings' && <SettingsContent sessionId={sessionId || ''} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function OverviewContent({
  session,
  runs,
  checkpoints,
}: {
  session: GhostlineSession | null
  runs: RunRecord[]
  checkpoints: Checkpoint[]
}) {
  const hasBaseline = session?.baselineRunId !== null

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {[
          { label: 'Session Status', value: session?.status || 'Unknown', color: '#10b981' },
          { label: 'Baseline Loaded', value: hasBaseline ? 'Yes' : 'No', color: hasBaseline ? '#06b6d4' : '#94a3b8' },
          { label: 'Checkpoints', value: String(checkpoints.length), color: '#06b6d4' },
          { label: 'Total Runs', value: String(session?.totalRuns || 0), color: '#06b6d4' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>{stat.label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: hasBaseline ? 'rgba(6, 182, 212, 0.05)' : 'rgba(239, 68, 68, 0.05)',
          border: `1px solid ${hasBaseline ? 'rgba(6, 182, 212, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>
          {hasBaseline ? 'Session Ready' : 'Quick Start'}
        </h3>
        <p style={{ color: '#94a3b8', marginBottom: '16px', lineHeight: 1.6 }}>
          {hasBaseline
            ? 'Baseline route loaded. You can replay, optimize, or teach a new route.'
            : 'No baseline route loaded. Start by teaching a route manually.'}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#020408',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start Teach Mode
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '20px',
          }}
        >
          <h4 style={{ marginBottom: '8px', fontSize: '0.9rem' }}>Recent Runs</h4>
          {runs.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No runs recorded yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {runs.slice(0, 5).map((run) => (
                <div
                  key={run.summary.runId}
                  style={{
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: run.summary.isValid ? '#10b981' : '#ef4444' }}>
                      {run.summary.isValid ? '✓' : '✗'} Run #{run.summary.generation}
                    </span>
                    <span style={{ color: '#06b6d4' }}>{run.summary.elapsedTime.toFixed(2)}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '20px',
          }}
        >
          <h4 style={{ marginBottom: '8px', fontSize: '0.9rem' }}>Best Run</h4>
          {session?.bestTime ? (
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#06b6d4', marginBottom: '8px' }}>
                {session.bestTime.toFixed(2)}s
              </div>
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                {checkpoints.length} checkpoints cleared
              </p>
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No best run recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function TeachModeContent() {
  const [wsConnected, setWsConnected] = useState(false)
  const [droneConnected, setDroneConnected] = useState(false)
  const [recording, setRecording] = useState(false)
  const [battery, setBattery] = useState(0)
  const [runCount, setRunCount] = useState(0)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    // Import drone service dynamically
    import('../ghostline/services/droneService').then(({ droneService }) => {
      // Connect to WebSocket server
      droneService.connect().then(() => {
        setWsConnected(true)
      }).catch((error) => {
        console.error('Failed to connect to drone service:', error)
      })

      // Listen for connection state changes
      const unsubConnection = droneService.onConnectionState((state) => {
        setDroneConnected(state.drone === 'connected')
        if (state.drone === 'connected') {
          droneService.getBattery().then(setBattery).catch(console.error)
        }
      })

      // Listen for telemetry to update battery
      const unsubTelemetry = droneService.onTelemetry((sample) => {
        if (sample.sensor?.batteryPercent) {
          setBattery(sample.sensor.batteryPercent)
        }
      })

      return () => {
        unsubConnection()
        unsubTelemetry()
        droneService.disconnect()
      }
    })
  }, [])

  const handleConnectDrone = async () => {
    setConnecting(true)
    try {
      const { droneService } = await import('../ghostline/services/droneService')
      await droneService.connectDrone()
    } catch (error) {
      console.error('Failed to connect drone:', error)
      alert('Failed to connect to drone. Make sure the Python backend is running.')
    } finally {
      setConnecting(false)
    }
  }

  const handleStartRecording = async () => {
    try {
      const { droneService } = await import('../ghostline/services/droneService')
      await droneService.startRecording()
      setRecording(true)
      setRunCount((c) => c + 1)
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const handleStopRecording = async () => {
    try {
      const { droneService } = await import('../ghostline/services/droneService')
      const result = await droneService.stopRecording()
      setRecording(false)
      
      console.log('Recorded telemetry:', result.telemetry)
      
      // Save to Firebase
      if (sessionId && result.telemetry.length > 0) {
        const runRecord: RunRecord = {
          summary: {
            runId: `run_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            sessionId: sessionId,
            generation: runCount,
            isBaseline: runCount === 1, // First run is baseline
            isValid: true, // Assume valid for teach mode
            isBestSoFar: false, // Will be determined by session stats
            elapsedTime: (result.telemetry[result.telemetry.length - 1].timestamp - result.telemetry[0].timestamp) / 1000,
            wallClockStart: result.telemetry[0].timestamp,
            wallClockEnd: result.telemetry[result.telemetry.length - 1].timestamp,
            batteryStart: result.telemetry[0].sensor?.batteryPercent || 0,
            batteryEnd: result.telemetry[result.telemetry.length - 1].sensor?.batteryPercent || 0,
            checkpointResults: [], // No checkpoints in teach mode
            abortReason: null,
          },
          telemetry: result.telemetry,
        }
        
        await ghostlineService.saveRun(runRecord)
        alert(`Recording saved! Captured ${result.telemetry.length} samples over ${runRecord.summary.elapsedTime.toFixed(2)}s`)
      } else {
        alert(`Recording complete! Captured ${result.telemetry.length} samples (not saved - no session)`)
      }
    } catch (error) {
      console.error('Failed to stop recording:', error)
      alert('Failed to save recording. Check console for details.')
    }
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* WebSocket Status */}
      <div
        style={{
          background: wsConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${wsConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '0.85rem',
        }}
      >
        {wsConnected ? (
          <span style={{ color: '#10b981' }}>✓ Connected to backend service</span>
        ) : (
          <span style={{ color: '#ef4444' }}>✗ Backend service not running. Start: python ghostline-backend/websocket_server.py</span>
        )}
      </div>

      {/* Connection Status */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ marginBottom: '16px' }}>Connection Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Drone</div>
            <div style={{ color: droneConnected ? '#10b981' : '#ef4444' }}>
              ● {droneConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Battery</div>
            <div style={{ color: battery > 30 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {battery}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Runs Recorded</div>
            <div style={{ fontWeight: 600 }}>{runCount}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleConnectDrone}
          disabled={!wsConnected || droneConnected || connecting}
          style={{
            padding: '10px 20px',
            background: droneConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(6, 182, 212, 0.1)',
            border: `1px solid ${droneConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
            borderRadius: '6px',
            color: droneConnected ? '#10b981' : '#06b6d4',
            cursor: (!wsConnected || droneConnected || connecting) ? 'not-allowed' : 'pointer',
            opacity: (!wsConnected || droneConnected || connecting) ? 0.5 : 1,
          }}
        >
          {connecting ? 'Connecting...' : droneConnected ? 'Connected' : 'Connect to Drone'}
        </button>
      </div>

      {/* Recording Controls */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 style={{ marginBottom: '16px' }}>Recording Controls</h3>
        <p style={{ color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>
          {recording ? (
            <span style={{ color: '#ef4444', fontWeight: 600 }}>● RECORDING - Fly your route. Click "Stop Recording" when done.</span>
          ) : (
            'Connect to your CoDrone EDU and click "Start Recording" to begin teaching. You can record multiple runs to build a better baseline.'
          )}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {!recording ? (
            <button
              type="button"
              onClick={handleStartRecording}
              disabled={!droneConnected}
              style={{
                padding: '12px 24px',
                background: droneConnected ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : '#374151',
                border: 'none',
                borderRadius: '6px',
                color: droneConnected ? '#020408' : '#6b7280',
                cursor: droneConnected ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              Start Recording
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopRecording}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              Stop Recording
            </button>
          )}
          <button
            type="button"
            disabled={!droneConnected || recording}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: (!droneConnected || recording) ? '#6b7280' : '#94a3b8',
              cursor: (!droneConnected || recording) ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Add Checkpoint Marker
          </button>
        </div>
        
        {runCount > 0 && (
          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              background: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.15)',
              borderRadius: '8px',
            }}
          >
            <p style={{ color: '#06b6d4', fontSize: '0.9rem', margin: 0 }}>
              ✓ {runCount} run{runCount !== 1 ? 's' : ''} recorded. You can record more runs to improve the baseline, or proceed to define checkpoints.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function CheckpointsContent({
  checkpoints,
  session: _session,
  onReload: _onReload,
}: {
  checkpoints: Checkpoint[]
  session: GhostlineSession | null
  onReload: () => Promise<void>
}) {
  return (
    <div style={{ maxWidth: '800px' }}>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Checkpoint Editor</h3>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '6px',
              color: '#06b6d4',
              cursor: 'pointer',
            }}
          >
            + Add Checkpoint
          </button>
        </div>
        {checkpoints.length === 0 ? (
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            No checkpoints defined. Record a teach session first, then mark positions from the recorded flight path.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {checkpoints.map((cp, index) => (
              <div
                key={cp.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#06b6d4', fontWeight: 600 }}>
                        #{index + 1}
                      </span>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{cp.label}</h4>
                      {!cp.active && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(100, 116, 139, 0.2)',
                            color: '#64748b',
                          }}
                        >
                          INACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Position: ({cp.x.toFixed(1)}, {cp.y.toFixed(1)}, {cp.z.toFixed(1)}) • Radius: {cp.radius}cm
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      padding: '4px 8px',
                      background: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '4px',
                      color: '#ef4444',
                      fontSize: '0.7rem',
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
      </div>
    </div>
  )
}

function ReplayContent({ session }: { session: GhostlineSession | null }) {
  const hasBaseline = session?.baselineRunId !== null

  return (
    <div style={{ maxWidth: '800px' }}>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 style={{ marginBottom: '16px' }}>Replay Engine</h3>
        {hasBaseline ? (
          <div>
            <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '16px' }}>
              Baseline route loaded. Connect to drone to begin replay.
            </p>
            <button
              type="button"
              disabled
              style={{
                padding: '10px 20px',
                background: '#374151',
                border: 'none',
                borderRadius: '6px',
                color: '#6b7280',
                cursor: 'not-allowed',
              }}
            >
              Start Replay (Connect Drone First)
            </button>
          </div>
        ) : (
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            No baseline route loaded. Complete a teach session to enable replay.
          </p>
        )}
      </div>
    </div>
  )
}

function OptimizeContent({ session }: { session: GhostlineSession | null }) {
  const hasBaseline = session?.baselineRunId !== null

  return (
    <div style={{ maxWidth: '800px' }}>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 style={{ marginBottom: '16px' }}>Optimization Session</h3>
        {hasBaseline ? (
          <div>
            <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '16px' }}>
              Baseline route loaded. The optimizer will iteratively refine the route to improve time while maintaining checkpoint validity.
            </p>
            <button
              type="button"
              disabled
              style={{
                padding: '10px 20px',
                background: '#374151',
                border: 'none',
                borderRadius: '6px',
                color: '#6b7280',
                cursor: 'not-allowed',
              }}
            >
              Start Optimization Loop (Connect Drone First)
            </button>
          </div>
        ) : (
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            No baseline route loaded. The optimizer requires a taught route and defined checkpoints to begin iteration.
          </p>
        )}
      </div>
    </div>
  )
}

function HistoryContent({ runs }: { runs: RunRecord[] }) {
  return (
    <div style={{ maxWidth: '1000px' }}>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 style={{ marginBottom: '16px' }}>Run History</h3>
        {runs.length === 0 ? (
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            No runs recorded yet. History will appear here after completing teach sessions and optimization runs.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {runs.map((run) => (
              <div
                key={run.summary.runId}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: '16px',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: run.summary.isValid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: run.summary.isValid ? '#10b981' : '#ef4444',
                    fontSize: '1.2rem',
                  }}
                >
                  {run.summary.isValid ? '✓' : '✗'}
                </div>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>Run #{run.summary.generation}</span>
                    {run.summary.isBaseline && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: '#06b6d4',
                        }}
                      >
                        BASELINE
                      </span>
                    )}
                    {run.summary.isBestSoFar && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                        }}
                      >
                        BEST
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {run.summary.checkpointResults.filter((r) => r.reached).length}/{run.summary.checkpointResults.length} checkpoints •{' '}
                    Battery: {run.summary.batteryStart}% → {run.summary.batteryEnd}%
                    {run.summary.abortReason && ` • Aborted: ${run.summary.abortReason}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#06b6d4' }}>
                    {run.summary.elapsedTime.toFixed(2)}s
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(run.summary.wallClockStart).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsContent({ sessionId: _sessionId }: { sessionId: string }) {
  return (
    <div style={{ maxWidth: '600px' }}>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 style={{ marginBottom: '20px' }}>Configuration</h3>
        <div style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
              Sample Interval (ms)
            </label>
            <input
              type="number"
              defaultValue={50}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '0.9rem',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
              Checkpoint Radius (cm)
            </label>
            <input
              type="number"
              defaultValue={30}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '0.9rem',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
              Low Battery Threshold (%)
            </label>
            <input
              type="number"
              defaultValue={20}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '0.9rem',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
              Elite Pool Size
            </label>
            <input
              type="number"
              defaultValue={10}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>
        <button
          type="button"
          style={{
            marginTop: '24px',
            padding: '10px 20px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '6px',
            color: '#06b6d4',
            cursor: 'pointer',
          }}
        >
          Save Configuration
        </button>
      </div>
    </div>
  )
}