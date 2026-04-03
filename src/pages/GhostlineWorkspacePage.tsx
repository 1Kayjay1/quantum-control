import { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import type { GhostlineSession, Checkpoint, RunRecord, OptimizerConfig } from '../ghostline/types'
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
  const { sessionId } = useParams<{ sessionId: string }>()
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
            wallClockStart: new Date(result.telemetry[0].timestamp).toISOString(),
            wallClockEnd: new Date(result.telemetry[result.telemetry.length - 1].timestamp).toISOString(),
            batteryStart: result.telemetry[0].sensor?.batteryPercent || 0,
            batteryEnd: result.telemetry[result.telemetry.length - 1].sensor?.batteryPercent || 0,
            checkpointResults: [], // No checkpoints in teach mode
            abortReason: null,
            parentCandidateId: null,
            mutationDescription: 'Manual teach mode recording',
            collisionSuspected: false,
            nearMiss: false,
            notes: `Teach mode run #${runCount}`,
          },
          rawTelemetry: result.telemetry,
          replayFrames: [], // Will be generated later for replay
          checkpointDefinitions: [], // No checkpoints yet
          configSnapshot: {
            sampleInterval: 50,
            replayInterval: 50,
            commandClamps: {
              maxRoll: 100,
              maxPitch: 100,
              maxYaw: 100,
              maxThrottle: 100,
            },
            smoothingMode: 'none',
            checkpointRadius: 30,
            yawTolerance: 45,
            safetyDistances: {
              minFrontRange: 20,
              minBottomRange: 10,
              maxAltitude: 200,
            },
            lowBatteryThreshold: 20,
            outOfBoundsLimits: {
              maxX: 300,
              maxY: 300,
              maxZ: 200,
            },
            maxSessionRuns: 100,
            hoverDuration: 1.0,
            mutationSizes: {
              timingCompression: 0.05,
              timingExpansion: 0.05,
              pitchRollAdjustment: 5,
              yawAdjustment: 10,
            },
            elitePoolSize: 10,
            acceptanceThreshold: 0.95,
            loggingVerbosity: 'normal',
            requiredSdkVersion: '2.5.0',
          },
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
  session,
  onReload,
}: {
  checkpoints: Checkpoint[]
  session: GhostlineSession | null
  onReload: () => Promise<void>
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCheckpoint, setNewCheckpoint] = useState({
    label: '',
    x: 0,
    y: 0,
    z: 0,
    radius: 30,
    desiredHeading: null as number | null,
    headingTolerance: 45,
    minHeight: null as number | null,
    notes: '',
  })
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session) {
      loadRuns()
    }
  }, [session])

  const loadRuns = async () => {
    if (!session) return
    setLoading(true)
    try {
      const runData = await ghostlineService.getRuns(session.id, 10)
      setRuns(runData)
    } catch (error) {
      console.error('Failed to load runs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFromPosition = () => {
    if (!selectedRun || selectedSampleIndex === null) return
    
    const run = runs.find(r => r.summary.runId === selectedRun)
    if (!run || !run.rawTelemetry[selectedSampleIndex]) return
    
    const sample = run.rawTelemetry[selectedSampleIndex]
    setNewCheckpoint({
      ...newCheckpoint,
      x: sample.position?.x || 0,
      y: sample.position?.y || 0,
      z: sample.position?.z || 0,
    })
    setShowCreateModal(true)
  }

  const handleCreateCheckpoint = async () => {
    if (!session || !newCheckpoint.label) return
    
    try {
      await ghostlineService.createCheckpoint({
        sessionId: session.id,
        label: newCheckpoint.label,
        x: newCheckpoint.x,
        y: newCheckpoint.y,
        z: newCheckpoint.z,
        radius: newCheckpoint.radius,
        orderIndex: checkpoints.length,
        active: true,
        desiredHeading: newCheckpoint.desiredHeading !== null ? newCheckpoint.desiredHeading : undefined,
        headingTolerance: newCheckpoint.headingTolerance,
        penaltyWeight: 1.0,
        minHeight: newCheckpoint.minHeight !== null ? newCheckpoint.minHeight : undefined,
        minEntrySpeed: undefined,
        maxEntrySpeed: undefined,
        notes: newCheckpoint.notes,
      })
      
      setShowCreateModal(false)
      setNewCheckpoint({
        label: '',
        x: 0,
        y: 0,
        z: 0,
        radius: 30,
        desiredHeading: null,
        headingTolerance: 45,
        minHeight: null,
        notes: '',
      })
      await onReload()
    } catch (error) {
      console.error('Failed to create checkpoint:', error)
      alert('Failed to create checkpoint. Check console for details.')
    }
  }

  const handleDeleteCheckpoint = async (checkpointId: string) => {
    if (!confirm('Delete this checkpoint?')) return
    
    try {
      await ghostlineService.deleteCheckpoint(checkpointId)
      await onReload()
    } catch (error) {
      console.error('Failed to delete checkpoint:', error)
      alert('Failed to delete checkpoint.')
    }
  }

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Checkpoint List */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Checkpoints ({checkpoints.length})</h3>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
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
            No checkpoints defined. Create checkpoints manually or select positions from recorded runs below.
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
                  <div style={{ flex: 1 }}>
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
                    <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'grid', gap: '4px' }}>
                      <div>Position: ({cp.x.toFixed(1)}, {cp.y.toFixed(1)}, {cp.z.toFixed(1)}) cm</div>
                      <div>Radius: {cp.radius} cm • Heading: {cp.desiredHeading !== null ? `${cp.desiredHeading}° ±${cp.headingTolerance}°` : 'Any'}</div>
                      {cp.notes && <div style={{ fontStyle: 'italic' }}>"{cp.notes}"</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCheckpoint(cp.id)}
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

      {/* Create from Recorded Runs */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 style={{ marginBottom: '16px' }}>Create from Recorded Runs</h3>
        <p style={{ color: '#64748b', marginBottom: '16px', fontSize: '0.9rem' }}>
          Select a run and a position from the telemetry to create a checkpoint at that location.
        </p>
        
        {loading ? (
          <p style={{ color: '#64748b' }}>Loading runs...</p>
        ) : runs.length === 0 ? (
          <p style={{ color: '#64748b' }}>No recorded runs available. Record a teach session first.</p>
        ) : (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                Select Run
              </label>
              <select
                value={selectedRun || ''}
                onChange={(e) => {
                  setSelectedRun(e.target.value)
                  setSelectedSampleIndex(null)
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.9rem',
                }}
              >
                <option value="">-- Select a run --</option>
                {runs.map((run) => (
                  <option key={run.summary.runId} value={run.summary.runId}>
                    Run #{run.summary.generation} - {run.summary.elapsedTime.toFixed(2)}s - {run.rawTelemetry.length} samples
                  </option>
                ))}
              </select>
            </div>
            
            {selectedRun && (() => {
              const run = runs.find(r => r.summary.runId === selectedRun)
              if (!run) return null
              
              return (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Select Position (Time: {selectedSampleIndex !== null ? ((run.rawTelemetry[selectedSampleIndex].timestamp - run.rawTelemetry[0].timestamp) / 1000).toFixed(2) : '0.00'}s)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={run.rawTelemetry.length - 1}
                    value={selectedSampleIndex || 0}
                    onChange={(e) => setSelectedSampleIndex(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      marginBottom: '12px',
                    }}
                  />
                  
                  {selectedSampleIndex !== null && run.rawTelemetry[selectedSampleIndex] && (
                    <div
                      style={{
                        padding: '12px',
                        background: 'rgba(6, 182, 212, 0.05)',
                        border: '1px solid rgba(6, 182, 212, 0.15)',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        <div>
                          <span style={{ color: '#64748b' }}>X:</span>{' '}
                          <span style={{ color: '#06b6d4' }}>{run.rawTelemetry[selectedSampleIndex].position?.x.toFixed(1) || 0} cm</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Y:</span>{' '}
                          <span style={{ color: '#06b6d4' }}>{run.rawTelemetry[selectedSampleIndex].position?.y.toFixed(1) || 0} cm</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Z:</span>{' '}
                          <span style={{ color: '#06b6d4' }}>{run.rawTelemetry[selectedSampleIndex].position?.z.toFixed(1) || 0} cm</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleCreateFromPosition}
                    disabled={selectedSampleIndex === null}
                    style={{
                      padding: '10px 20px',
                      background: selectedSampleIndex !== null ? 'rgba(6, 182, 212, 0.1)' : '#374151',
                      border: `1px solid ${selectedSampleIndex !== null ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: '6px',
                      color: selectedSampleIndex !== null ? '#06b6d4' : '#6b7280',
                      cursor: selectedSampleIndex !== null ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Create Checkpoint at This Position
                  </button>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: '#0a0e14',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '20px' }}>Create Checkpoint</h3>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Label *
                </label>
                <input
                  type="text"
                  value={newCheckpoint.label}
                  onChange={(e) => setNewCheckpoint({ ...newCheckpoint, label: e.target.value })}
                  placeholder="e.g., Start Gate, Turn 1, Finish"
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
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    X (cm)
                  </label>
                  <input
                    type="number"
                    value={newCheckpoint.x}
                    onChange={(e) => setNewCheckpoint({ ...newCheckpoint, x: parseFloat(e.target.value) || 0 })}
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
                    Y (cm)
                  </label>
                  <input
                    type="number"
                    value={newCheckpoint.y}
                    onChange={(e) => setNewCheckpoint({ ...newCheckpoint, y: parseFloat(e.target.value) || 0 })}
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
                    Z (cm)
                  </label>
                  <input
                    type="number"
                    value={newCheckpoint.z}
                    onChange={(e) => setNewCheckpoint({ ...newCheckpoint, z: parseFloat(e.target.value) || 0 })}
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
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Radius (cm)
                </label>
                <input
                  type="number"
                  value={newCheckpoint.radius}
                  onChange={(e) => setNewCheckpoint({ ...newCheckpoint, radius: parseFloat(e.target.value) || 30 })}
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
                  Notes (optional)
                </label>
                <textarea
                  value={newCheckpoint.notes}
                  onChange={(e) => setNewCheckpoint({ ...newCheckpoint, notes: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={handleCreateCheckpoint}
                disabled={!newCheckpoint.label}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  background: newCheckpoint.label ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  color: newCheckpoint.label ? '#020408' : '#6b7280',
                  cursor: newCheckpoint.label ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                Create Checkpoint
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReplayContent({ session }: { session: GhostlineSession | null }) {
  const [baselineRun, setBaselineRun] = useState<RunRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [droneConnected, setDroneConnected] = useState(false)

  useEffect(() => {
    loadBaseline()
    checkDroneConnection()
  }, [session])

  const loadBaseline = async () => {
    if (!session?.baselineRunId) return
    
    setLoading(true)
    try {
      const run = await ghostlineService.getRun(session.baselineRunId)
      setBaselineRun(run)
    } catch (error) {
      console.error('Failed to load baseline:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkDroneConnection = async () => {
    try {
      const { droneService } = await import('../ghostline/services/droneService')
      const state = await droneService.connectDrone()
      setDroneConnected(state.drone === 'connected')
    } catch (error) {
      setDroneConnected(false)
    }
  }

  const handleStartReplay = async () => {
    if (!baselineRun || !droneConnected) return
    
    setReplaying(true)
    setProgress({ current: 0, total: 0 })
    
    try {
      const { droneService } = await import('../ghostline/services/droneService')
      const { executeReplay, compileReplayFrames } = await import('../ghostline/services/replayService')
      
      // Compile replay frames if not already compiled
      let frames = baselineRun.replayFrames
      if (!frames || frames.length === 0) {
        console.log('Compiling replay frames from telemetry...')
        frames = compileReplayFrames(baselineRun.rawTelemetry, {
          sampleInterval: 50,
          replayInterval: 50,
          smoothingMode: 'linear',
          commandClamps: {
            maxRoll: 100,
            maxPitch: 100,
            maxYaw: 100,
            maxThrottle: 100,
          },
        })
        
        // Save compiled frames
        baselineRun.replayFrames = frames
        await ghostlineService.saveRun(baselineRun)
      }
      
      setProgress({ current: 0, total: frames.length })
      
      // Execute replay
      await executeReplay(frames, droneService, (current, total) => {
        setProgress({ current, total })
      })
      
      alert('Replay complete!')
    } catch (error) {
      console.error('Replay failed:', error)
      alert(`Replay failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setReplaying(false)
    }
  }

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
        
        {loading ? (
          <p style={{ color: '#64748b' }}>Loading baseline...</p>
        ) : !hasBaseline ? (
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            No baseline route loaded. Complete a teach session to enable replay.
          </p>
        ) : (
          <div>
            <div
              style={{
                padding: '16px',
                background: 'rgba(6, 182, 212, 0.05)',
                border: '1px solid rgba(6, 182, 212, 0.15)',
                borderRadius: '8px',
                marginBottom: '20px',
              }}
            >
              <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Baseline Route</h4>
              {baselineRun && (
                <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'grid', gap: '4px' }}>
                  <div>Duration: {baselineRun.summary.elapsedTime.toFixed(2)}s</div>
                  <div>Telemetry Samples: {baselineRun.rawTelemetry.length}</div>
                  <div>Replay Frames: {baselineRun.replayFrames?.length || 'Not compiled'}</div>
                  <div>Battery: {baselineRun.summary.batteryStart}% → {baselineRun.summary.batteryEnd}%</div>
                </div>
              )}
            </div>
            
            <div
              style={{
                padding: '16px',
                background: droneConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${droneConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '0.85rem',
              }}
            >
              {droneConnected ? (
                <span style={{ color: '#10b981' }}>✓ Drone connected and ready</span>
              ) : (
                <span style={{ color: '#ef4444' }}>✗ Drone not connected. Connect drone in Teach Mode first.</span>
              )}
            </div>
            
            {replaying && (
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(6, 182, 212, 0.05)',
                  border: '1px solid rgba(6, 182, 212, 0.15)',
                  borderRadius: '8px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#06b6d4' }}>
                  Replaying... {progress.current} / {progress.total} frames
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            )}
            
            <button
              type="button"
              onClick={handleStartReplay}
              disabled={!droneConnected || replaying}
              style={{
                padding: '12px 24px',
                background: droneConnected && !replaying ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : '#374151',
                border: 'none',
                borderRadius: '6px',
                color: droneConnected && !replaying ? '#020408' : '#6b7280',
                cursor: droneConnected && !replaying ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              {replaying ? 'Replaying...' : 'Start Replay'}
            </button>
            
            <div
              style={{
                marginTop: '20px',
                padding: '12px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: '#f59e0b',
              }}
            >
              ⚠️ Safety: Clear the flight area, have emergency stop ready, and monitor the drone during replay.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OptimizeContent({ session }: { session: GhostlineSession | null }) {
  const [baselineRun, setBaselineRun] = useState<RunRecord | null>(null)
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [loading, setLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [droneConnected, setDroneConnected] = useState(false)
  const [optimizationState, setOptimizationState] = useState({
    generation: 0,
    bestTime: 0,
    improvements: 0,
  })
  const [maxGenerations, setMaxGenerations] = useState(30)
  const optimizerRef = useRef<any>(null)

  useEffect(() => {
    loadData()
    checkDroneConnection()
  }, [session])

  const loadData = async () => {
    if (!session) return
    
    setLoading(true)
    try {
      const [run, cps] = await Promise.all([
        session.baselineRunId ? ghostlineService.getRun(session.baselineRunId) : null,
        ghostlineService.getCheckpoints(session.id),
      ])
      setBaselineRun(run)
      setCheckpoints(cps)
      if (run) {
        setOptimizationState(prev => ({ ...prev, bestTime: run.summary.elapsedTime }))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkDroneConnection = async () => {
    try {
      const { droneService } = await import('../ghostline/services/droneService')
      const state = await droneService.connectDrone()
      setDroneConnected(state.drone === 'connected')
    } catch (error) {
      setDroneConnected(false)
    }
  }

  const handleStartOptimization = async () => {
    if (!baselineRun || !droneConnected || !session) return
    
    setOptimizing(true)
    setOptimizationState({ generation: 0, bestTime: baselineRun.summary.elapsedTime, improvements: 0 })
    
    try {
      const { droneService } = await import('../ghostline/services/droneService')
      const { OptimizationEngine } = await import('../ghostline/services/optimizationService')
      
      // Create optimizer
      const config: OptimizerConfig = {
        sampleInterval: 50,
        replayInterval: 50,
        commandClamps: {
          maxRoll: 100,
          maxPitch: 100,
          maxYaw: 100,
          maxThrottle: 100,
        },
        smoothingMode: 'linear',
        checkpointRadius: 30,
        yawTolerance: 45,
        safetyDistances: {
          minFrontRange: 20,
          minBottomRange: 10,
          maxAltitude: 200,
        },
        lowBatteryThreshold: 20,
        outOfBoundsLimits: {
          maxX: 300,
          maxY: 300,
          maxZ: 200,
        },
        maxSessionRuns: 100,
        hoverDuration: 1.0,
        mutationSizes: {
          timingCompression: 0.05,
          timingExpansion: 0.05,
          pitchRollAdjustment: 5,
          yawAdjustment: 10,
        },
        elitePoolSize: 10,
        acceptanceThreshold: 0.95,
        loggingVerbosity: 'normal',
        requiredSdkVersion: '2.5.0',
      }
      
      const optimizer = new OptimizationEngine(
        session.id,
        baselineRun,
        checkpoints,
        config,
        (state) => {
          setOptimizationState({
            generation: state.generation,
            bestTime: state.bestTime,
            improvements: state.elitePool.length,
          })
        }
      )
      
      optimizerRef.current = optimizer
      
      // Run optimization
      await optimizer.optimize(droneService, maxGenerations)
      
      alert(`Optimization complete! Best time: ${optimizer.getState().bestTime.toFixed(2)}s`)
      
      // Reload session data
      await loadData()
    } catch (error) {
      console.error('Optimization failed:', error)
      alert(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setOptimizing(false)
      optimizerRef.current = null
    }
  }

  const handleStopOptimization = () => {
    if (optimizerRef.current) {
      optimizerRef.current.stop()
    }
  }

  const hasBaseline = session?.baselineRunId !== null
  const hasCheckpoints = checkpoints.length > 0

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
        
        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : !hasBaseline ? (
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            No baseline route loaded. The optimizer requires a taught route and defined checkpoints to begin iteration.
          </p>
        ) : (
          <div>
            {/* Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Baseline Time</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#06b6d4' }}>
                  {baselineRun?.summary.elapsedTime.toFixed(2)}s
                </div>
              </div>
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Checkpoints</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: hasCheckpoints ? '#10b981' : '#ef4444' }}>
                  {checkpoints.length}
                </div>
              </div>
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Drone Status</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: droneConnected ? '#10b981' : '#ef4444' }}>
                  {droneConnected ? 'Ready' : 'Not Connected'}
                </div>
              </div>
            </div>
            
            {/* Optimization Progress */}
            {optimizing && (
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(6, 182, 212, 0.05)',
                  border: '1px solid rgba(6, 182, 212, 0.15)',
                  borderRadius: '8px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#06b6d4' }}>
                      Generation {optimizationState.generation} / {maxGenerations}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#06b6d4' }}>
                      Best: {optimizationState.bestTime.toFixed(2)}s
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(optimizationState.generation / maxGenerations) * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Elite pool: {optimizationState.improvements} candidates
                </div>
              </div>
            )}
            
            {/* Configuration */}
            {!optimizing && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Max Generations
                </label>
                <input
                  type="number"
                  value={maxGenerations}
                  onChange={(e) => setMaxGenerations(parseInt(e.target.value) || 30)}
                  min="1"
                  max="100"
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
            )}
            
            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {!optimizing ? (
                <button
                  type="button"
                  onClick={handleStartOptimization}
                  disabled={!droneConnected || !hasCheckpoints}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: droneConnected && hasCheckpoints ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    color: droneConnected && hasCheckpoints ? '#020408' : '#6b7280',
                    cursor: droneConnected && hasCheckpoints ? 'pointer' : 'not-allowed',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  }}
                >
                  Start Optimization Loop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopOptimization}
                  style={{
                    flex: 1,
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
                  Stop Optimization
                </button>
              )}
            </div>
            
            {/* Warnings */}
            {!hasCheckpoints && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: '#ef4444',
                }}
              >
                ⚠️ No checkpoints defined. Create checkpoints first to enable optimization.
              </div>
            )}
            
            <div
              style={{
                marginTop: '20px',
                padding: '12px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: '#f59e0b',
              }}
            >
              ℹ️ Optimization will run multiple test flights. Ensure you have spare batteries and a clear flight area.
            </div>
          </div>
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