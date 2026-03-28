export type Vector3 = {
  x: number
  y: number
  z: number
}

export type InstructionKind =
  | 'takeoff'
  | 'land'
  | 'hover'
  | 'moveForward'
  | 'moveBackward'
  | 'strafeLeft'
  | 'strafeRight'
  | 'moveUp'
  | 'moveDown'
  | 'rotateCW'
  | 'rotateCCW'
  | 'wait'

export type FieldObjectType =
  | 'wall'
  | 'gate'
  | 'ring'
  | 'landingZone'
  | 'scoringZone'
  | 'marker'
  | 'boundary'
  | 'archGate'
  | 'keyholeGate'
  | 'tunnel'
  | 'flyThroughPanel'
  | 'colorMat'
  | 'programmingMat'
  | 'landingPad'
  | 'cubeLarge'
  | 'cubeSmall'
  | 'miniArchGate'
  | 'pillar'

export type MissionCheckpointType =
  | 'archGate'
  | 'keyholeGate'
  | 'tunnel'
  | 'flyThroughPanel'
  | 'colorMat'
  | 'landingPad'
  | 'miniArchGate'
  | 'cubeLarge'
  | 'cubeSmall'
  | 'custom'

export type MissionPassCondition =
  | 'flyUnder'
  | 'flyThrough'
  | 'flyIntoZone'
  | 'detectColor'
  | 'landOn'

export type LandingSurface = 'landingPad' | 'bullseye' | 'cubeLarge' | 'cubeSmall' | 'none'
export type CollisionContactType =
  | 'bodyHit'
  | 'armBrush'
  | 'motorGuardBrush'
  | 'grazingContact'
  | 'hardStop'

export type PlaybackState = 'idle' | 'playing' | 'paused'
export type SimulationMode = 'quick' | 'replay' | 'analysis'
export type WorkspaceMode = 'editor' | 'scene'
export type TimelineDockState = 'collapsed' | 'edit' | 'analysis'
export type SimulationPipelineStageId =
  | 'compile'
  | 'runtime'
  | 'planned'
  | 'actual'
  | 'checks'
  | 'metrics'
  | 'confidence'
  | 'replay'

export interface SimulationPipelineStage {
  id: SimulationPipelineStageId
  label: string
  status: 'pending' | 'active' | 'completed' | 'skipped'
}

export interface DronePose {
  position: Vector3
  heading: number
  airborne: boolean
}

export interface DroneSpawn {
  position: Vector3
  heading: number
}

export interface InstructionBlock {
  id: string
  kind: InstructionKind
  label: string
  strength: number
  distance: number
  angle: number
  speed: number
  duration: number
  delayAfter: number
  stackNextBy: number
  note: string
  versionTag: string
  enabled: boolean
  timelineLane?: number
}

export interface RouteVersion {
  id: string
  name: string
  description: string
  timingResolution: number
  instructions: InstructionBlock[]
  createdAt: string
  updatedAt: string
}

export interface FieldObject {
  id: string
  type: FieldObjectType
  name: string
  position: Vector3
  rotation: Vector3
  size: Vector3
  color: string
  checkpointOrder?: number | null
  isSolid?: boolean
  windResponsive?: boolean
  scoreValue?: number
  note?: string
  colorTag?: 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple' | 'white' | 'black'
  detectionDelayMs?: number
  metadata?: {
    outerWidthCm?: number
    outerHeightCm?: number
    outerDepthCm?: number
    innerWidthCm?: number
    innerHeightCm?: number
    innerDepthCm?: number
    outerDiameterCm?: number
    innerDiameterCm?: number
    bullseyeDiameterCm?: number
    tunnelLengthCm?: number
    totalSections?: number
    sectionWidthCm?: number
    panelHeightCm?: number
    largeHoleDiameterCm?: number
    smallHoleDiameterCm?: number
    tensionStringHeightCm?: number
    landingSurface?: LandingSurface
  }
}

export interface MissionCheckpoint {
  id: string
  label: string
  order: number
  objectId: string
  checkpointType: MissionCheckpointType
  passCondition: MissionPassCondition
  required: boolean
  completed: boolean
  completedTime: number | null
  invalidated: boolean
  note: string
}

export interface FieldLayout {
  id: string
  name: string
  width: number
  length: number
  height: number
  objects: FieldObject[]
  missionCheckpoints: MissionCheckpoint[]
  spawn: DroneSpawn
  notes: string
}

export interface BehaviorProfile {
  id: string
  name: string
  massKg: number
  hoverAssistPct: number
  hoverBrakeAssistPct: number
  altitudeHoldGain: number
  attitudeHoldGain: number
  referenceVelocityBlend: number
  referencePositionGain: number
  referenceHeadingAssist: number
  driftLateralCmPerMeter: number
  driftForwardCmPerMeter: number
  driftVerticalCmPerMeter: number
  dragPct: number
  overshootPct: number
  underTravelPct: number
  turnDelayMs: number
  reactionDelayMs: number
  speedVariationPct: number
  accelerationCurve: number
  decelerationCurve: number
  turnResponsePct: number
  carryPct: number
  coastDurationMs: number
  referenceAssistDuringCoastPct: number
  randomizeConditions: boolean
  randomizationPct: number
  gustStrengthCmS2: number
  propWashStrength: number
  objectDraftStrength: number
}

export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  fieldLayouts: FieldLayout[]
  routeVersions: RouteVersion[]
  behaviorProfiles: BehaviorProfile[]
}

export interface PlannedSegment {
  id: string
  routeVersionId: string
  instructionId: string
  instructionLabel: string
  kind: InstructionKind
  startPose: DronePose
  endPose: DronePose
  plannedDistance: number
  plannedAngle: number
  commandSpeed: number
  duration: number
  delayAfter: number
  stackNextBy: number
  scheduledStart: number
  scheduledEnd: number
  note: string
  plannedPoints: Vector3[]
}

export interface FailureMarker {
  id: string
  instructionId: string
  type: 'collision' | 'miss' | 'risk' | 'checkpoint' | 'landing'
  message: string
  position: Vector3
  time: number
  severity?: 'brush' | 'bump' | 'hard'
  rawContactCount?: number
  contactType?: CollisionContactType
  normal?: Vector3
}

export interface CollisionEvent {
  id: string
  objectId: string
  objectName: string
  instructionId: string
  segmentId: string
  firstContactTime: number
  lastContactTime: number
  contactCount: number
  rawContactCount: number
  severity: 'brush' | 'bump' | 'hard'
  peakSpeed: number
  position: Vector3
  representativeContactPoint: Vector3
  representativeNormal: Vector3
  contactType: CollisionContactType
}

export interface SimulationTracePoint {
  time: number
  normalizedTime: number
  instructionId: string
  segmentId: string
  dynamicObjectPositions?: Record<string, Vector3>
  plannedPosition: Vector3
  actualPosition: Vector3
  plannedHeading: number
  actualHeading: number
  plannedSpeed: number
  actualSpeed: number
  plannedPitch: number
  plannedRoll: number
  actualPitch: number
  actualRoll: number
  dynamicObjects?: Array<{
    objectId: string
    position: Vector3
    rotation: Vector3
  }>
}

export interface CheckpointResult {
  checkpointId: string
  objectId: string
  label: string
  name: string
  order: number
  checkpointType: MissionCheckpointType
  passCondition: MissionPassCondition
  required: boolean
  completed: boolean
  completedTime: number | null
  invalidated: boolean
  note: string
  status: 'pending' | 'hit' | 'skipped' | 'outOfOrder' | 'invalidated'
  hitTime: number | null
}

export interface LandingResult {
  surface: LandingSurface
  objectId: string | null
  valid: boolean
  atTime: number | null
  message: string
}

export interface SimulationSegmentResult {
  id: string
  instructionId: string
  instructionLabel: string
  kind: InstructionKind
  plannedEnd: DronePose
  actualEnd: DronePose
  plannedDuration: number
  actualDuration: number
  delayAfter: number
  deviation: number
  collisions: string[]
  checkpointHits: string[]
  outOfOrderCheckpointIds: string[]
  skippedCheckpointIds: string[]
  missedTargets: string[]
  riskFlags: string[]
  plannedPoints: Vector3[]
  actualPoints: Vector3[]
  startTime: number
  endTime: number
}

export interface RunMetrics {
  totalTime: number
  instructionCount: number
  turnCount: number
  collisionCount: number
  pathDeviation: number
  checkpointHits: number
  checkpointTargetCount: number
  riskPoints: number
  efficiencyScore: number
  consistencyScore: number
  completionSuccessEstimate: number
  routeValid: boolean
  routeInvalidReason: string | null
  landingResult: LandingResult
}

export interface SimulationSolveSummary {
  seed: number
  physicsSteps: number
  tracePoints: number
  checkpointChecks: number
  monteCarloRuns: number
  solveTimeMs: number
  averageNoiseMagnitude: number
  driftAccumulation: number
}

export interface SimulationRun {
  id: string
  routeVersionId: string
  behaviorProfileId: string
  fieldLayoutId: string
  seed: number
  createdAt: string
  plannedSegments: PlannedSegment[]
  segments: SimulationSegmentResult[]
  trace: SimulationTracePoint[]
  failureMarkers: FailureMarker[]
  collisionEvents: CollisionEvent[]
  checkpointResults: CheckpointResult[]
  completedCheckpointIds: string[]
  skippedCheckpointIds: string[]
  invalidCheckpointIds: string[]
  routeInvalidReason: string | null
  landingResult: LandingResult
  contactedObjectIds: string[]
  missedObjectIds: string[]
  metrics: RunMetrics
  solveSummary?: SimulationSolveSummary
}

export interface DeepAnalysisResult {
  sampleCount: number
  successEstimate: number
  averagePathDeviation: number
  worstDeviation: number
  bestTime: number
  worstTime: number
  collisionCountMin: number
  collisionCountMax: number
  consistencySpread: number
}

export interface ComparisonSnapshot {
  routeAId: string
  routeBId: string
  scoreA: number
  scoreB: number
  fasterRouteId: string
  saferRouteId: string
  deltaTime: number
  deltaRisk: number
  deltaDeviation: number
  deltaCollisions: number
  winner: string
  recommendation: string
}

export interface ManualRouteSheet {
  title: string
  subtitle: string
  warning: string
  steps: string[]
  summary: string[]
}

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: string
}
