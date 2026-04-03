/**
 * Ghostline - CoDrone EDU Route Optimizer
 * 
 * A deterministic, iterative optimizer that starts from a human-taught baseline
 * and keeps refining the champion route.
 */

// ============================================================================
// Workspace & Session Model
// ============================================================================

export interface GhostlineWorkspace {
  id: string
  name: string
  description?: string
  type: 'personal' | 'team'
  ownerId: string
  teamId?: string
  createdAt: Date
  lastModified: Date
  sessionIds: string[]
}

export interface GhostlineSession {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: 'active' | 'archived' | 'completed'
  createdAt: Date
  lastModified: Date
  ownerId: string
  // Session stats
  totalRuns: number
  bestTime: number | null
  checkpointCount: number
  // References
  baselineRunId: string | null
  bestRunId: string | null
}

// ============================================================================
// Raw Recording Model
// ============================================================================

export interface RawSample {
  timestamp: number
  // Raw controller inputs
  joystick: {
    leftX: number
    leftY: number
    rightX: number
    rightY: number
  }
  // Button states
  buttons: {
    l1: boolean
    r1: boolean
    // Add other buttons as needed
  }
  // Normalized command values sent to drone
  command: {
    roll: number
    pitch: number
    yaw: number
    throttle: number
  }
  // Bulk sensor snapshot (31 values from get_sensor_data())
  sensor: SensorSnapshot
  // Position from optical flow
  position: PositionData
  // Event markers
  event?: TelemetryEvent
}

export interface SensorSnapshot {
  timestamp: number
  // Acceleration
  accelX: number
  accelY: number
  accelZ: number
  // Gyro
  gyroX: number
  gyroY: number
  gyroZ: number
  // Angles
  angleX: number
  angleY: number
  angleZ: number
  // Position (optical flow)
  x: number
  y: number
  z: number
  // Range sensors
  frontRange: number
  bottomRange: number
  // State
  movementState: number
  batteryPercent: number
  speedSetting: number
  // Error state
  errorState: number
}

export interface PositionData {
  time: number
  x: number
  y: number
  z: number
}

export type TelemetryEvent =
  | { type: 'session_start' }
  | { type: 'teach_mode_armed' }
  | { type: 'recording_started' }
  | { type: 'takeoff_started' }
  | { type: 'stable_hover_ready' }
  | { type: 'route_start_marker' }
  | { type: 'checkpoint_marker'; checkpointId: string }
  | { type: 'route_end_marker' }
  | { type: 'landing_started' }
  | { type: 'landed' }
  | { type: 'session_end' }
  | { type: 'disconnect' }
  | { type: 'abort'; reason: string }
  | { type: 'save'; runId: string }

// ============================================================================
// Replay Frame Model
// ============================================================================

export interface ReplayFrame {
  timestampOffset: number
  roll: number
  pitch: number
  yaw: number
  throttle: number
  targetDuration: number // ms
  correctionPolicy?: CorrectionPolicy
  expectedState?: Partial<SensorSnapshot>
}

export type CorrectionPolicy = 'none' | 'hover' | 'position' | 'heading'

// ============================================================================
// Checkpoint Model
// ============================================================================

export interface Checkpoint {
  id: string
  sessionId: string
  label: string
  x: number
  y: number
  z: number
  radius: number // tolerance in cm
  orderIndex: number
  active: boolean
  // Optional constraints
  desiredHeading?: number
  headingTolerance?: number
  penaltyWeight?: number
  minHeight?: number
  minEntrySpeed?: number
  maxEntrySpeed?: number
  notes?: string
  createdAt: Date
}

export interface CheckpointResult {
  checkpointId: string
  reached: boolean
  firstEntryTime: number | null
  closestApproachDistance: number | null
  entryVelocity: number | null
  exitVelocity: number | null
  headingAtCheckpoint: number | null
  overshootAmount: number | null
  lingerDuration: number | null
  orderCorrect: boolean
}

// ============================================================================
// Run Model
// ============================================================================

export interface RunSummary {
  runId: string
  sessionId: string
  generation: number
  parentCandidateId: string | null
  isBaseline: boolean
  mutationDescription: string | null
  isValid: boolean
  elapsedTime: number
  checkpointResults: CheckpointResult[]
  collisionSuspected: boolean
  nearMiss: boolean
  abortReason: string | null
  batteryStart: number
  batteryEnd: number
  isBestSoFar: boolean
  notes: string | null
  wallClockStart: string
  wallClockEnd: string
}

export interface RunRecord {
  summary: RunSummary
  rawTelemetry: RawSample[]
  replayFrames: ReplayFrame[]
  checkpointDefinitions: Checkpoint[]
  configSnapshot: OptimizerConfig
}

// ============================================================================
// Optimizer Model
// ============================================================================

export interface OptimizerConfig {
  sampleInterval: number
  replayInterval: number
  commandClamps: {
    maxRoll: number
    maxPitch: number
    maxYaw: number
    maxThrottle: number
  }
  smoothingMode: 'none' | 'linear' | 'cubic'
  checkpointRadius: number
  yawTolerance: number
  safetyDistances: {
    minFrontRange: number
    minBottomRange: number
    maxAltitude: number
  }
  lowBatteryThreshold: number
  outOfBoundsLimits: {
    maxX: number
    maxY: number
    maxZ: number
  }
  maxSessionRuns: number
  hoverDuration: number
  mutationSizes: {
    timingCompression: number
    timingExpansion: number
    pitchRollAdjustment: number
    yawAdjustment: number
  }
  elitePoolSize: number
  acceptanceThreshold: number
  loggingVerbosity: 'minimal' | 'normal' | 'verbose'
  requiredSdkVersion: string
}

export type MutationStrategy =
  | 'timing_compression'
  | 'timing_expansion'
  | 'pitch_roll_balance'
  | 'hover_reduction'
  | 'transition_smoothing'
  | 'corner_tightening'
  | 'yaw_timing'
  | 'checkpoint_approach_offset'
  | 'entry_exit_speed'
  | 'interpolation_refinement'
  | 'segment_resampling'
  | 'elite_segment_swap'

export interface MutationRecord {
  strategy: MutationStrategy
  segmentIndex: number
  parameters: Record<string, number>
  timestamp: string
}

// ============================================================================
// Session State Model
// ============================================================================

export interface SessionState {
  sessionId: string
  batteryBlockCount: number
  generation: number
  runNumber: number
  baselineVersion: string | null
  optimizerConfigVersion: string
  startTimestamp: string
  endTimestamp: string | null
  cumulativeValidRuns: number
  cumulativeFailureCount: number
  cumulativeCollisionCount: number
  bestTimeThisSession: number | null
  bestTimeAllTime: number | null
  status: 'idle' | 'recording' | 'replaying' | 'optimizing' | 'paused' | 'error'
}

// ============================================================================
// Elite Memory Model
// ============================================================================

export interface EliteMemory {
  sessionId: string
  baselineRun: RunRecord | null
  bestRun: RunRecord | null
  elitePool: RunRecord[]
  bestPerSegment: Map<string, RunRecord>
  recentFailedCandidates: RunRecord[]
  mutationHistory: MutationRecord[]
  sessionSummaries: SessionState[]
  checkpointDefinitions: Checkpoint[]
  configSnapshots: Map<string, OptimizerConfig>
}

// ============================================================================
// Connection State
// ============================================================================

export interface ConnectionState {
  drone: 'disconnected' | 'connecting' | 'connected' | 'error'
  controller: 'disconnected' | 'connecting' | 'connected' | 'error'
  lastHeartbeat: number | null
  errorMessage: string | null
}

// ============================================================================
// Safety State
// ============================================================================

export interface SafetyState {
  frontRange: number
  bottomRange: number
  altitude: number
  position: PositionData
  attitude: { roll: number; pitch: number; yaw: number }
  batteryPercent: number
  errorState: number
  opticalFlowStatus: 'ok' | 'degraded' | 'failed'
  lastUpdate: number
  violations: SafetyViolation[]
}

export interface SafetyViolation {
  type: 'low_battery' | 'obstacle' | 'altitude' | 'bounds' | 'attitude' | 'sensor' | 'optical_flow'
  severity: 'warning' | 'critical' | 'emergency'
  message: string
  timestamp: number
}
