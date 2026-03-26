import { Body, Box, ContactMaterial, Material, Plane, Quaternion, Sphere, Vec3, World } from 'cannon-es'

import {
  AIR_DENSITY_KG_M3,
  DRONE_DRAG_COEFFICIENT,
  DRONE_FRONTAL_AREA_M2,
  DRONE_COLLIDER_HALF_EXTENTS_CM,
  DRONE_MAX_SPEED_MPS,
  DRONE_PLANFORM_AREA_M2,
  DRONE_ROTOR_RADIUS_M,
  MONTE_CARLO_RUNS,
  PHYSICS_SETTLE_SECONDS,
  PHYSICS_STEP_SECONDS,
} from '../constants'
import {
  classifyDroneContactType,
  DRONE_PHYSICS_PROXY_COMPONENTS,
  type DroneProxyContactType,
  toDroneLocalPoint,
} from '../droneCollision'
import { createId } from '../id'
import {
  checkpointSatisfied,
  clamp,
  createSeededRandom,
  degreesToRadians,
  distanceBetween,
  distanceToObject,
  headingVector,
  lerp,
  normalizeHeading,
  projectPointToObjectSurface,
  resolveLandingSurface,
  signedNoise,
  strafeVector,
} from '../math'
import { buildFailureMarker, calculatePathDeviation, getTracePointAtTime } from './analysis'
import { addPhysicsBody, applyBodyForce, createPhysicsWorld, getBodyState, stepPhysicsWorld } from './physicsAdapter'
import type {
  BehaviorProfile,
  CheckpointResult,
  CollisionEvent,
  DeepAnalysisResult,
  FailureMarker,
  FieldLayout,
  FieldObject,
  LandingResult,
  MissionCheckpoint,
  PlannedSegment,
  RunMetrics,
  SimulationRun,
  SimulationSegmentResult,
  SimulationTracePoint,
  Vector3,
} from '../types'

const DRONE_HALF_HEIGHT_METERS = DRONE_COLLIDER_HALF_EXTENTS_CM.y / 100

interface RuntimeWindow {
  segment: PlannedSegment
  start: number
  end: number
}

type EffectiveBehaviorProfile = BehaviorProfile

interface DroneSimState {
  body: Body
  heading: number
  holdAltitudeMeters: number
  pitch: number
  roll: number
  yawRateDegS: number
  disturbanceHorizontal: Vector3
  disturbanceVerticalMps: number
  disturbanceYawDegS: number
  disturbanceMagnitude: number
  lastHorizontalCommand: Vector3
  coastVelocity: Vector3
  coastTimer: number
  coastDuration: number
  isCoasting: boolean
  wasCommandingHorizontal: boolean
  collisionAftershock: number
  maxPostCollisionVerticalVelocity: number | null
  collisionSurfaceNormal: Vector3 | null
}

interface DraftObjectBody {
  objectId: string
  body: Body
  anchorY: number
}

interface SimWorldContext {
  world: World
  body: Body
  collidableObjects: FieldObject[]
  obstacleBodyIds: Map<number, string>
  draftBodies: DraftObjectBody[]
}

type CollisionSeverity = 'brush' | 'bump' | 'hard'

interface ActiveCollisionEvent {
  eventId: string
  objectId: string
  objectName: string
  instructionId: string
  segmentId: string
  firstContactTime: number
  lastContactTime: number
  contactCount: number
  rawContactCount: number
  peakSpeed: number
  maxApproach: number
  peakContactCount: number
  representativeContactPoint: Vector3
  representativeNormal: Vector3
  contactType: DroneProxyContactType
}

interface CollisionContactCluster {
  objectId: string
  rawContactCount: number
  peakSpeed: number
  maxApproach: number
  peakContactCount: number
  representativeContactPoint: Vector3
  representativeNormal: Vector3
  contactType: DroneProxyContactType
}

interface ControlIntent {
  desiredHorizontal: Vector3
  verticalRateCmS: number
  yawRateDegS: number
  autoHover: boolean
  hasHorizontalCommand: boolean
  activeSegmentIds: string[]
  activeInstructionIds: string[]
  primarySegmentId: string
  primaryInstructionId: string
}

interface ReferenceFlightState {
  positionMeters: Vec3
  velocityMetersPerSecond: Vec3
  heading: number
}

const DEFAULT_REFERENCE_VELOCITY_BLEND = 0.18
const DEFAULT_REFERENCE_POSITION_GAIN = 0.25
const DEFAULT_REFERENCE_HEADING_ASSIST = 0.58
const COLLISION_AFTERSHOCK_SECONDS = 0.72
const STEP_NOISE_RESPONSE = 2.6
const STEP_NOISE_SPEED_SCALE = 0.08
const STEP_NOISE_YAW_SCALE = 12
const STEP_NOISE_VERTICAL_SCALE = 0.09
const COLLISION_COOLDOWN_SECONDS = 1.1
const COLLISION_MERGE_DISTANCE_CM = 16
const COLLISION_AFTERSHOCK_MULTIPLIER: Record<CollisionSeverity, number> = {
  brush: 0.65,
  bump: 1,
  hard: 1.45,
}
const COLLISION_PUSH_SCALE: Record<CollisionSeverity, number> = {
  brush: 0.08,
  bump: 0.16,
  hard: 0.26,
}

function toMeters(valueInCentimeters: number): number {
  return valueInCentimeters / 100
}

function toCentimeters(valueInMeters: number): number {
  return valueInMeters * 100
}

function vec3FromMeters(vec: Vec3): Vector3 {
  return {
    x: toCentimeters(vec.x),
    y: toCentimeters(vec.y),
    z: toCentimeters(vec.z),
  }
}

function getGroundEffectGain(heightMeters: number): number {
  const effectiveHeight = Math.max(heightMeters, DRONE_ROTOR_RADIUS_M * 0.65)
  const ratio = DRONE_ROTOR_RADIUS_M / (4 * effectiveHeight)
  return clamp(1 + ratio * ratio, 1, 1.18)
}

function getDirtyAirFactor(verticalVelocityMps: number, horizontalSpeedMps: number): number {
  if (verticalVelocityMps >= -0.12) {
    return 0
  }

  const sinkFactor = clamp((-verticalVelocityMps - 0.12) / 0.75, 0, 1)
  const lowForwardSpeedFactor = clamp(1 - horizontalSpeedMps / 0.45, 0, 1)
  return sinkFactor * lowForwardSpeedFactor
}

function quaternionFromEulerDegrees(rotation: Vector3): Quaternion {
  const quaternion = new Quaternion()
  quaternion.setFromEuler(
    degreesToRadians(rotation.x),
    degreesToRadians(rotation.y),
    degreesToRadians(rotation.z),
    'XYZ',
  )
  return quaternion
}

function getHeadingFromBody(body: Body): number {
  const forward = body.quaternion.vmult(new Vec3(1, 0, 0))
  return normalizeHeading((Math.atan2(forward.z, forward.x) * 180) / Math.PI)
}

function getRotationFromBody(body: Body): Vector3 {
  const up = body.quaternion.vmult(new Vec3(0, 1, 0))
  return {
    x: (Math.atan2(up.z, Math.max(Math.abs(up.y), 0.0001)) * 180) / Math.PI,
    y: getHeadingFromBody(body),
    z: (-Math.atan2(up.x, Math.max(Math.abs(up.y), 0.0001)) * 180) / Math.PI,
  }
}

function getHeadingDeltaDegrees(target: number, current: number): number {
  const delta = normalizeHeading(target - current)
  return delta > 180 ? delta - 360 : delta
}

function setBodyToYawOnly(body: Body, heading: number): void {
  body.quaternion.copy(
    quaternionFromEulerDegrees({
      x: 0,
      y: heading,
      z: 0,
    }),
  )
  body.angularVelocity.x = 0
  body.angularVelocity.y = 0
  body.angularVelocity.z = 0
}

function addDroneCollider(body: Body) {
  for (const component of DRONE_PHYSICS_PROXY_COMPONENTS) {
    const offset = new Vec3(component.offset.x, component.offset.y, component.offset.z)
    if (component.shape === 'sphere') {
      body.addShape(new Sphere(component.radius ?? 0), offset)
      continue
    }

    body.addShape(
      new Box(
        new Vec3(
          (component.size?.x ?? 0) * 0.5,
          (component.size?.y ?? 0) * 0.5,
          (component.size?.z ?? 0) * 0.5,
        ),
      ),
      offset,
    )
  }
}

function createWorld(
  layout: FieldLayout,
  profile: EffectiveBehaviorProfile,
  includeObstacles: boolean,
): SimWorldContext {
  const adapter = createPhysicsWorld()
  const world = adapter.world
  world.gravity.set(0, -9.81, 0)
  world.allowSleep = false
  world.defaultContactMaterial.friction = 0.42
  world.defaultContactMaterial.restitution = clamp(0.08 + profile.overshootPct * 0.24, 0.06, 0.24)

  const droneMaterial = new Material('drone')
  const fieldMaterial = new Material('field')
  world.addContactMaterial(
    new ContactMaterial(droneMaterial, fieldMaterial, {
      friction: 0.4,
      restitution: clamp(0.08 + profile.overshootPct * 0.28, 0.06, 0.28),
    }),
  )

  const ground = new Body({ mass: 0, material: fieldMaterial })
  ground.addShape(new Plane())
  ground.position.set(0, -DRONE_HALF_HEIGHT_METERS, 0)
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0, 'XYZ')
  addPhysicsBody(adapter, ground)

  const collidableObjects = includeObstacles
    ? layout.objects.filter((object) => object.isSolid || object.type === 'wall' || object.type === 'boundary')
    : []
  const obstacleBodyIds = new Map<number, string>()
  const draftBodies: DraftObjectBody[] = []

  for (const object of collidableObjects) {
    const body = new Body({
      mass: 0,
      material: fieldMaterial,
      position: new Vec3(
        toMeters(object.position.x),
        toMeters(object.position.y),
        toMeters(object.position.z),
      ),
      quaternion: quaternionFromEulerDegrees(object.rotation),
    })
    body.addShape(
      new Box(
        new Vec3(
          toMeters(object.size.x * 0.5),
          toMeters(object.size.y * 0.5),
          toMeters(object.size.z * 0.5),
        ),
      ),
    )
    addPhysicsBody(adapter, body)
    obstacleBodyIds.set(body.id, object.id)
  }

  if (includeObstacles) {
    for (const object of layout.objects.filter((candidate) => candidate.windResponsive && !candidate.isSolid)) {
      const body = new Body({
        mass: clamp((object.size.x + object.size.y + object.size.z) / 1100, 0.03, 0.12),
        material: fieldMaterial,
        linearDamping: 0.86,
        angularDamping: 0.98,
        position: new Vec3(
          toMeters(object.position.x),
          toMeters(object.position.y),
          toMeters(object.position.z),
        ),
        quaternion: quaternionFromEulerDegrees(object.rotation),
      })
      body.addShape(
        new Box(
          new Vec3(
            Math.max(toMeters(object.size.x * 0.5), 0.04),
            Math.max(toMeters(object.size.y * 0.5), 0.04),
            Math.max(toMeters(object.size.z * 0.5), 0.04),
          ),
        ),
      )
      body.angularFactor.set(0, 1, 0)
      addPhysicsBody(adapter, body)
      draftBodies.push({
        objectId: object.id,
        body,
        anchorY: toMeters(object.position.y),
      })
    }
  }

  const droneBody = new Body({
    mass: profile.massKg,
    material: droneMaterial,
    linearDamping: clamp(0.2 + profile.dragPct * 0.9, 0.16, 0.78),
    angularDamping: 0.88,
    position: new Vec3(
      toMeters(layout.spawn.position.x),
      toMeters(layout.spawn.position.y),
      toMeters(layout.spawn.position.z),
    ),
    quaternion: quaternionFromEulerDegrees({
      x: 0,
      y: layout.spawn.heading,
      z: 0,
    }),
  })
  addDroneCollider(droneBody)
  droneBody.angularFactor.set(0, 0, 0)
  droneBody.updateMassProperties()
  addPhysicsBody(adapter, droneBody)

  return {
    world,
    body: droneBody,
    collidableObjects,
    obstacleBodyIds,
    draftBodies,
  }
}

function createCheckpointResults(
  checkpoints: MissionCheckpoint[],
  objects: FieldObject[],
): CheckpointResult[] {
  return checkpoints.map((checkpoint) => ({
    checkpointId: checkpoint.id,
    objectId: checkpoint.objectId,
    label: checkpoint.label,
    name: objects.find((object) => object.id === checkpoint.objectId)?.name ?? checkpoint.label,
    order: checkpoint.order,
    checkpointType: checkpoint.checkpointType,
    passCondition: checkpoint.passCondition,
    required: checkpoint.required,
    completed: checkpoint.completed,
    completedTime: checkpoint.completedTime,
    invalidated: checkpoint.invalidated,
    note: checkpoint.note,
    status: 'pending',
    hitTime: null,
  }))
}

function buildEffectiveProfile(
  profile: BehaviorProfile,
  random: () => number,
): EffectiveBehaviorProfile {
  const amount = profile.randomizeConditions ? profile.randomizationPct : 0
  const jitter = (value: number, floor = -Infinity, ceiling = Infinity) =>
    clamp(value * (1 + signedNoise(random, amount)), floor, ceiling)

  return {
    ...profile,
    driftLateralCmPerMeter: jitter(profile.driftLateralCmPerMeter, -24, 24),
    driftForwardCmPerMeter: jitter(profile.driftForwardCmPerMeter, -18, 18),
    driftVerticalCmPerMeter: jitter(profile.driftVerticalCmPerMeter, -8, 8),
    dragPct: jitter(profile.dragPct, 0, 0.55),
    overshootPct: jitter(profile.overshootPct, 0, 0.35),
    underTravelPct: jitter(profile.underTravelPct, 0, 0.35),
    turnDelayMs: jitter(profile.turnDelayMs, 0, 900),
    reactionDelayMs: jitter(profile.reactionDelayMs, 0, 900),
    speedVariationPct: jitter(profile.speedVariationPct, 0, 0.4),
    accelerationCurve: jitter(profile.accelerationCurve, 0.3, 1.4),
    decelerationCurve: jitter(profile.decelerationCurve, 0.25, 1.4),
    turnResponsePct: jitter(profile.turnResponsePct, 0.35, 1.2),
    carryPct: jitter(profile.carryPct, 0, 0.85),
    coastDurationMs: jitter(profile.coastDurationMs, 0, 1400),
    hoverBrakeAssistPct: jitter(profile.hoverBrakeAssistPct, 0.15, 1.2),
    referenceAssistDuringCoastPct: jitter(profile.referenceAssistDuringCoastPct, 0, 0.8),
    randomizationPct: profile.randomizationPct,
    gustStrengthCmS2: jitter(profile.gustStrengthCmS2, 0, 90),
    propWashStrength: jitter(profile.propWashStrength, 0, 1.4),
    objectDraftStrength: jitter(profile.objectDraftStrength, 0, 1.2),
  }
}

function buildPlannedProfile(profile: BehaviorProfile): EffectiveBehaviorProfile {
  return {
    ...profile,
    driftLateralCmPerMeter: 0,
    driftForwardCmPerMeter: 0,
    driftVerticalCmPerMeter: 0,
    dragPct: 0.02,
    overshootPct: 0,
    underTravelPct: 0,
    turnDelayMs: 0,
    reactionDelayMs: 0,
    speedVariationPct: 0,
    accelerationCurve: 1,
    decelerationCurve: 1,
    turnResponsePct: 1,
    carryPct: 0,
    coastDurationMs: 0,
    hoverBrakeAssistPct: 1,
    referenceAssistDuringCoastPct: 0,
    randomizeConditions: false,
    randomizationPct: 0,
    gustStrengthCmS2: 0,
    propWashStrength: 0,
    objectDraftStrength: 0,
  }
}

function buildRuntimeWindows(
  segments: PlannedSegment[],
  profile: EffectiveBehaviorProfile,
  random: () => number,
  isActual: boolean,
): RuntimeWindow[] {
  return segments.map((segment) => {
    if (!isActual) {
      return {
        segment,
        start: segment.scheduledStart,
        end: segment.scheduledEnd,
      }
    }

    const responseDelay = profile.reactionDelayMs / 1000
    const turnDelay =
      segment.kind === 'rotateCW' || segment.kind === 'rotateCCW'
        ? profile.turnDelayMs / 1000
        : 0
    const startJitter = profile.randomizeConditions
      ? signedNoise(random, profile.randomizationPct * 0.22)
      : 0
    const start = Math.max(0, segment.scheduledStart + responseDelay + turnDelay + startJitter)

    return {
      segment,
      start,
      end: start + segment.duration,
    }
  })
}

function getPrimaryWindow(windows: RuntimeWindow[], time: number): RuntimeWindow | null {
  const active = windows.filter((window) => time >= window.start && time < window.end)
  if (active.length > 0) {
    return active.at(-1) ?? null
  }

  const started = windows.filter((window) => time >= window.start)
  if (started.length > 0) {
    return started.at(-1) ?? null
  }

  return windows[0] ?? null
}

function getActiveWindows(windows: RuntimeWindow[], time: number): RuntimeWindow[] {
  return windows.filter((window) => time >= window.start && time < window.end)
}

function resolveIntent(
  windows: RuntimeWindow[],
  time: number,
  heading: number,
): ControlIntent {
  const active = getActiveWindows(windows, time)
  const primary = getPrimaryWindow(windows, time)

  if (!primary) {
    return {
      desiredHorizontal: { x: 0, y: 0, z: 0 },
      verticalRateCmS: 0,
      yawRateDegS: 0,
      autoHover: false,
      hasHorizontalCommand: false,
      activeSegmentIds: [],
      activeInstructionIds: [],
      primarySegmentId: '',
      primaryInstructionId: '',
    }
  }

  let desiredHorizontal: Vector3 = { x: 0, y: 0, z: 0 }
  let verticalRateCmS = 0
  let yawRateDegS = 0
  const previousWindow = windows
    .filter((window) => time >= window.end)
    .at(-1) ?? null

  for (const window of active) {
    const forward = headingVector(heading)
    const right = strafeVector(heading, 1)
    const segment = window.segment
    const speed = segment.commandSpeed

    switch (segment.kind) {
      case 'moveForward':
        desiredHorizontal = {
          x: desiredHorizontal.x + forward.x * speed,
          y: 0,
          z: desiredHorizontal.z + forward.z * speed,
        }
        break
      case 'moveBackward':
        desiredHorizontal = {
          x: desiredHorizontal.x - forward.x * speed,
          y: 0,
          z: desiredHorizontal.z - forward.z * speed,
        }
        break
      case 'strafeLeft':
        desiredHorizontal = {
          x: desiredHorizontal.x - right.x * speed,
          y: 0,
          z: desiredHorizontal.z - right.z * speed,
        }
        break
      case 'strafeRight':
        desiredHorizontal = {
          x: desiredHorizontal.x + right.x * speed,
          y: 0,
          z: desiredHorizontal.z + right.z * speed,
        }
        break
      case 'moveUp':
      case 'takeoff':
        verticalRateCmS += speed
        break
      case 'moveDown':
      case 'land':
        verticalRateCmS -= speed
        break
      case 'rotateCW':
        yawRateDegS += speed
        break
      case 'rotateCCW':
        yawRateDegS -= speed
        break
      default:
        break
    }
  }

  return {
    desiredHorizontal,
    verticalRateCmS,
    yawRateDegS,
    autoHover:
      active.length === 0 &&
      previousWindow !== null &&
      previousWindow.segment.kind !== 'land' &&
      previousWindow.segment.endPose.airborne,
    hasHorizontalCommand:
      Math.abs(desiredHorizontal.x) > 0.001 || Math.abs(desiredHorizontal.z) > 0.001,
    activeSegmentIds: active.map((window) => window.segment.id),
    activeInstructionIds: active.map((window) => window.segment.instructionId),
    primarySegmentId: primary.segment.id,
    primaryInstructionId: primary.segment.instructionId,
  }
}

function applyDroneControl(
  state: DroneSimState,
  profile: EffectiveBehaviorProfile,
  intent: ControlIntent,
  dt: number,
  time: number,
  seed: number,
  reference?: ReferenceFlightState,
  random?: () => number,
): void {
  const massKg = profile.massKg
  const hoverForce = massKg * 9.81 * clamp(profile.hoverAssistPct, 0.88, 1.12)
  const headingResponse = clamp(profile.turnResponsePct * 10 * profile.attitudeHoldGain, 3.5, 16)
  const isAirborne = state.body.position.y > 0.05 || state.holdAltitudeMeters > 0.08
  state.collisionAftershock = Math.max(state.collisionAftershock - dt, 0)
  if (state.collisionAftershock <= 0) {
    state.maxPostCollisionVerticalVelocity = null
    state.collisionSurfaceNormal = null
  }
  const aftershockPct =
    COLLISION_AFTERSHOCK_SECONDS > 0
      ? clamp(state.collisionAftershock / COLLISION_AFTERSHOCK_SECONDS, 0, 1)
      : 0
  const referenceHeadingAssist = clamp(
    profile.referenceHeadingAssist ?? DEFAULT_REFERENCE_HEADING_ASSIST,
    0,
    1.2,
  )
  const headingError = reference
    ? getHeadingDeltaDegrees(reference.heading, state.heading)
    : 0
  const yawAssistDegS = clamp(
    headingError *
      clamp(headingResponse * 1.8 * referenceHeadingAssist * (1 - aftershockPct * 0.72), 4, 22),
    -220,
    220,
  )
  const desiredYawRateDegS = clamp(
    intent.yawRateDegS * (reference ? 0.18 : 1) + yawAssistDegS,
    -240,
    240,
  )
  const yawBlend = clamp(dt * headingResponse, 0, 1)
  const nextYawRateDegS = lerp(state.yawRateDegS, desiredYawRateDegS, yawBlend)
  state.yawRateDegS = nextYawRateDegS
  state.body.angularVelocity.x = 0
  state.body.angularVelocity.y = 0
  state.body.angularVelocity.z = 0

  const speedScale =
    1 +
    Math.sin(time * 3.6 + seed * 0.17) * profile.speedVariationPct -
    profile.underTravelPct +
    profile.overshootPct * 0.12

  if (Math.abs(intent.verticalRateCmS) > 0.001) {
    state.holdAltitudeMeters = clamp(
      state.holdAltitudeMeters + toMeters(intent.verticalRateCmS) * dt * speedScale,
      0,
      5,
    )
  }
  if (reference) {
    state.holdAltitudeMeters = lerp(
      state.holdAltitudeMeters,
      reference.positionMeters.y,
      clamp(dt * 5.8, 0, 1),
    )
  }

  const forward = headingVector(state.heading)
  const right = strafeVector(state.heading, 1)
  const rawCommandedHorizontalMps = {
    x: toMeters(intent.desiredHorizontal.x) * speedScale,
    y: 0,
    z: toMeters(intent.desiredHorizontal.z) * speedScale,
  }
  const commandedMagnitude = Math.hypot(rawCommandedHorizontalMps.x, rawCommandedHorizontalMps.z)
  const hasHorizontalCommand = intent.hasHorizontalCommand && commandedMagnitude > 0.0001
  const currentVelocity = getBodyState({ body: state.body }).velocity
  const horizontalSpeed = Math.hypot(currentVelocity.x, currentVelocity.z)
  const localForwardSpeed = currentVelocity.x * forward.x + currentVelocity.z * forward.z
  const localRightSpeed = currentVelocity.x * right.x + currentVelocity.z * right.z
  const coastDurationSeconds = Math.max(profile.coastDurationMs / 1000, 0)
  const carryPct = clamp(profile.carryPct, 0, 0.85)
  const referenceAssistDuringCoastPct = clamp(profile.referenceAssistDuringCoastPct, 0, 0.8)
  const hoverBrakeAssistPct = clamp(profile.hoverBrakeAssistPct, 0.15, 1.2)
  const overlapIntensity = clamp((intent.activeInstructionIds.length - 1) / 3, 0, 1)
  const inputIntensity = clamp(commandedMagnitude / Math.max(DRONE_MAX_SPEED_MPS, 0.001), 0, 1)
  const speedIntensity = clamp(horizontalSpeed / Math.max(DRONE_MAX_SPEED_MPS, 0.001), 0, 1)
  const stepVariation =
    random && profile.randomizeConditions
      ? clamp(
          profile.randomizationPct *
            (0.24 + inputIntensity * 0.36 + overlapIntensity * 0.28 + speedIntensity * 0.22),
          0,
          0.42,
        )
      : 0

  if (stepVariation > 0 && random) {
    const targetHorizontalForward =
      signedNoise(random, stepVariation) * (STEP_NOISE_SPEED_SCALE + profile.gustStrengthCmS2 / 500)
    const targetHorizontalRight =
      signedNoise(random, stepVariation) * (STEP_NOISE_SPEED_SCALE + profile.driftLateralCmPerMeter / 220)
    const targetVertical =
      signedNoise(random, stepVariation) *
      STEP_NOISE_VERTICAL_SCALE *
      (0.3 + inputIntensity * 0.6)
    const targetYaw =
      signedNoise(random, stepVariation) *
      STEP_NOISE_YAW_SCALE *
      (0.2 + inputIntensity * 0.35 + overlapIntensity * 0.3)

    const disturbanceBlend = clamp(dt * STEP_NOISE_RESPONSE, 0, 1)
    state.disturbanceHorizontal = {
      x: lerp(
        state.disturbanceHorizontal.x,
        forward.x * targetHorizontalForward + right.x * targetHorizontalRight,
        disturbanceBlend,
      ),
      y: 0,
      z: lerp(
        state.disturbanceHorizontal.z,
        forward.z * targetHorizontalForward + right.z * targetHorizontalRight,
        disturbanceBlend,
      ),
    }
    state.disturbanceVerticalMps = lerp(
      state.disturbanceVerticalMps,
      targetVertical,
      disturbanceBlend,
    )
    state.disturbanceYawDegS = lerp(
      state.disturbanceYawDegS,
      targetYaw,
      disturbanceBlend,
    )
  } else {
    const disturbanceBlend = clamp(dt * (STEP_NOISE_RESPONSE + 0.8), 0, 1)
    state.disturbanceHorizontal = {
      x: lerp(state.disturbanceHorizontal.x, 0, disturbanceBlend),
      y: 0,
      z: lerp(state.disturbanceHorizontal.z, 0, disturbanceBlend),
    }
    state.disturbanceVerticalMps = lerp(state.disturbanceVerticalMps, 0, disturbanceBlend)
    state.disturbanceYawDegS = lerp(state.disturbanceYawDegS, 0, disturbanceBlend)
  }

  if (hasHorizontalCommand) {
    if (state.isCoasting) {
      const carryProgress =
        state.coastDuration > 0 ? clamp(state.coastTimer / state.coastDuration, 0, 1) : 1
      const remainingCarry = 1 - carryProgress
      rawCommandedHorizontalMps.x += state.coastVelocity.x * remainingCarry
      rawCommandedHorizontalMps.z += state.coastVelocity.z * remainingCarry
    }

    state.lastHorizontalCommand = {
      x: rawCommandedHorizontalMps.x,
      y: 0,
      z: rawCommandedHorizontalMps.z,
    }
    state.coastVelocity = {
      x: lerp(state.coastVelocity.x, rawCommandedHorizontalMps.x, clamp(dt * 8.5, 0, 1)),
      y: 0,
      z: lerp(state.coastVelocity.z, rawCommandedHorizontalMps.z, clamp(dt * 8.5, 0, 1)),
    }
    state.coastTimer = 0
    state.coastDuration = coastDurationSeconds
    state.isCoasting = false
  } else {
    const canStartCoast =
      state.wasCommandingHorizontal &&
      isAirborne &&
      coastDurationSeconds > 0 &&
      intent.verticalRateCmS >= -0.001

    if (canStartCoast) {
      state.isCoasting = true
      state.coastTimer = 0
      state.coastDuration = coastDurationSeconds
      const carryScale = clamp(0.28 + carryPct * 1.18, 0.18, 1.08)
      state.coastVelocity = {
        x: lerp(state.lastHorizontalCommand.x, currentVelocity.x, 0.25) * carryScale,
        y: 0,
        z: lerp(state.lastHorizontalCommand.z, currentVelocity.z, 0.25) * carryScale,
      }
    }

    if (state.isCoasting) {
      state.coastTimer += dt
      const carryProgress =
        state.coastDuration > 0 ? clamp(state.coastTimer / state.coastDuration, 0, 1) : 1
      rawCommandedHorizontalMps.x = lerp(state.coastVelocity.x, 0, carryProgress)
      rawCommandedHorizontalMps.z = lerp(state.coastVelocity.z, 0, carryProgress)

      if (
        carryProgress >= 1 ||
        Math.hypot(rawCommandedHorizontalMps.x, rawCommandedHorizontalMps.z) < 0.035 ||
        !isAirborne ||
        intent.verticalRateCmS < -0.001
      ) {
        state.isCoasting = false
        state.coastTimer = state.coastDuration
        rawCommandedHorizontalMps.x = 0
        rawCommandedHorizontalMps.z = 0
      }
    }
  }

  state.wasCommandingHorizontal = hasHorizontalCommand

  const referenceVelocityBlendBase = clamp(
    profile.referenceVelocityBlend ?? DEFAULT_REFERENCE_VELOCITY_BLEND,
    0,
    0.8,
  )
  const referenceVelocityBlend = reference
    ? state.isCoasting
      ? referenceAssistDuringCoastPct
      : referenceVelocityBlendBase * (1 - aftershockPct * 0.7)
    : 0
  const desiredHorizontalMps = reference
    ? {
        x: lerp(
          rawCommandedHorizontalMps.x,
          reference.velocityMetersPerSecond.x,
          referenceVelocityBlend,
        ),
        y: 0,
        z: lerp(
          rawCommandedHorizontalMps.z,
          reference.velocityMetersPerSecond.z,
          referenceVelocityBlend,
        ),
      }
    : { ...rawCommandedHorizontalMps }

  if (reference) {
    const baseTrackingGain = clamp(
      (profile.referencePositionGain ?? DEFAULT_REFERENCE_POSITION_GAIN) *
        (4.2 + profile.turnResponsePct * 1.6),
      0.45,
      4.4,
    )
    const trackingGain = state.isCoasting
      ? baseTrackingGain * referenceAssistDuringCoastPct
      : baseTrackingGain * (1 - aftershockPct * 0.78)
    desiredHorizontalMps.x +=
      (reference.positionMeters.x - state.body.position.x) * trackingGain
    desiredHorizontalMps.z +=
      (reference.positionMeters.z - state.body.position.z) * trackingGain
  }

  const lateralBias = horizontalSpeed * toMeters(profile.driftLateralCmPerMeter)
  const forwardBias = horizontalSpeed * toMeters(profile.driftForwardCmPerMeter)
  desiredHorizontalMps.x += right.x * lateralBias + forward.x * forwardBias
  desiredHorizontalMps.z += right.z * lateralBias + forward.z * forwardBias

  if (profile.gustStrengthCmS2 > 0) {
    const gustScale = intent.autoHover ? 0.2 : 1
    const gustX =
      Math.sin(time * 1.4 + seed * 0.11) * toMeters(profile.gustStrengthCmS2) * 0.18 * gustScale
    const gustZ =
      Math.cos(time * 1.1 + seed * 0.07) * toMeters(profile.gustStrengthCmS2) * 0.18 * gustScale
    desiredHorizontalMps.x += gustX
    desiredHorizontalMps.z += gustZ
  }

  desiredHorizontalMps.x += state.disturbanceHorizontal.x
  desiredHorizontalMps.z += state.disturbanceHorizontal.z

  if (aftershockPct > 0 && state.collisionSurfaceNormal) {
    const horizontalCollisionNormal = normalizeVector({
      x: state.collisionSurfaceNormal.x,
      y: 0,
      z: state.collisionSurfaceNormal.z,
    })
    const intoSurfaceVelocity =
      desiredHorizontalMps.x * horizontalCollisionNormal.x +
      desiredHorizontalMps.z * horizontalCollisionNormal.z
    if (intoSurfaceVelocity < 0) {
      const removalStrength = clamp(0.82 + aftershockPct * 0.3, 0, 1.08)
      desiredHorizontalMps.x -= horizontalCollisionNormal.x * intoSurfaceVelocity * removalStrength
      desiredHorizontalMps.z -= horizontalCollisionNormal.z * intoSurfaceVelocity * removalStrength
    }
  }

  const groundEffectGain = getGroundEffectGain(state.body.position.y)
  const dirtyAirFactor = getDirtyAirFactor(currentVelocity.y, horizontalSpeed) * (intent.autoHover ? 0.18 : 1)
  const dirtyAirSway = dirtyAirFactor * (0.02 + profile.propWashStrength * 0.035)

  const horizontalResponse = intent.activeInstructionIds.length > 0
    ? clamp(8 * profile.accelerationCurve * profile.attitudeHoldGain, 3, 11)
    : state.isCoasting
      ? clamp(
          1.55 * profile.decelerationCurve * hoverBrakeAssistPct,
          0.45,
          2.4,
        )
    : intent.autoHover
      ? clamp(
          9.5 * profile.accelerationCurve * profile.attitudeHoldGain * hoverBrakeAssistPct,
          2.6,
          12,
        )
    : clamp(4.4 * profile.decelerationCurve * (1 - profile.overshootPct * 0.65), 1.3, 8)

  const forceX = massKg * (desiredHorizontalMps.x - currentVelocity.x) * horizontalResponse
  const forceZ = massKg * (desiredHorizontalMps.z - currentVelocity.z) * horizontalResponse
  const dragForceX =
    -0.5 *
    AIR_DENSITY_KG_M3 *
    DRONE_DRAG_COEFFICIENT *
    DRONE_FRONTAL_AREA_M2 *
    currentVelocity.x *
    Math.abs(currentVelocity.x)
  const dragForceZ =
    -0.5 *
    AIR_DENSITY_KG_M3 *
    DRONE_DRAG_COEFFICIENT *
    DRONE_FRONTAL_AREA_M2 *
    currentVelocity.z *
    Math.abs(currentVelocity.z)
  const swayForceX =
    massKg *
    dirtyAirSway *
    Math.sin(time * 2.7 + seed * 0.21)
  const swayForceZ =
    massKg *
    dirtyAirSway *
    Math.cos(time * 2.3 + seed * 0.17)
  let desiredVerticalVelocity = clamp(
    toMeters(intent.verticalRateCmS) * speedScale +
      (state.holdAltitudeMeters - state.body.position.y) * clamp(profile.altitudeHoldGain, 2.4, 9) -
      dirtyAirFactor * 0.22 +
      state.disturbanceVerticalMps,
    -1.8,
    1.8,
  )
  if (
    aftershockPct > 0 &&
    state.collisionSurfaceNormal &&
    Math.abs(state.collisionSurfaceNormal.y) < 0.45
  ) {
    const cappedRecoveryVelocity = 0.06 + (1 - aftershockPct) * 0.05
    desiredVerticalVelocity = Math.min(desiredVerticalVelocity, cappedRecoveryVelocity)
  }
  const verticalResponse = clamp(5.8 * profile.altitudeHoldGain / 5.8, 3.4, 9.4)
  const desiredVerticalAcceleration = clamp(
    (desiredVerticalVelocity - currentVelocity.y) * verticalResponse,
    -4.2,
    4.2,
  )
  const verticalDragForce =
    -0.5 *
    AIR_DENSITY_KG_M3 *
    DRONE_DRAG_COEFFICIENT *
    DRONE_PLANFORM_AREA_M2 *
    currentVelocity.y *
    Math.abs(currentVelocity.y)
  const forceY = hoverForce * groundEffectGain + massKg * desiredVerticalAcceleration + verticalDragForce

  applyBodyForce(
    { body: state.body },
    new Vec3(
      forceX + dragForceX + swayForceX,
      forceY,
      forceZ + dragForceZ + swayForceZ,
    ),
    state.body.position,
  )
  state.body.linearDamping = clamp(
    0.18 +
      profile.dragPct * 0.75 +
      (intent.activeInstructionIds.length > 0
        ? 0
        : state.isCoasting
          ? 0.01 + hoverBrakeAssistPct * 0.025
          : intent.autoHover
            ? 0.08 + hoverBrakeAssistPct * 0.12
            : 0.06),
    0.12,
    0.82,
  )
  if (aftershockPct > 0) {
    state.body.linearDamping = Math.max(0.1, state.body.linearDamping - aftershockPct * 0.08)
  }

  const desiredPitch = clamp(
    -(localForwardSpeed * 0.18 +
      (desiredHorizontalMps.x * forward.x + desiredHorizontalMps.z * forward.z) * 0.05),
    -0.42,
    0.42,
  )
  const desiredRoll = clamp(
    -(localRightSpeed * 0.2 + (desiredHorizontalMps.x * right.x + desiredHorizontalMps.z * right.z) * 0.05),
    -0.42,
    0.42,
  )
  state.pitch = lerp(state.pitch, desiredPitch, clamp(dt * 6.5, 0, 1))
  state.roll = lerp(state.roll, desiredRoll, clamp(dt * 6.5, 0, 1))
  if (aftershockPct > 0) {
    state.pitch += Math.sin(time * 19 + seed * 0.13) * 0.08 * aftershockPct
    state.roll += Math.cos(time * 17 + seed * 0.09) * 0.08 * aftershockPct
  }
  state.heading = normalizeHeading(
    state.heading + (nextYawRateDegS + state.disturbanceYawDegS) * dt,
  )
  state.disturbanceMagnitude =
    Math.hypot(
      state.disturbanceHorizontal.x,
      state.disturbanceHorizontal.z,
      state.disturbanceVerticalMps,
    ) + Math.abs(state.disturbanceYawDegS) * 0.01

  const maxHorizontalSpeed = Math.max(
    Math.hypot(desiredHorizontalMps.x, desiredHorizontalMps.z) + 0.55,
    0.55,
  )
  const speedLimit = Math.min(maxHorizontalSpeed, DRONE_MAX_SPEED_MPS)
  const actualHorizontalSpeed = Math.hypot(state.body.velocity.x, state.body.velocity.z)
  if (actualHorizontalSpeed > speedLimit) {
    const scale = speedLimit / actualHorizontalSpeed
    state.body.velocity.x *= scale
    state.body.velocity.z *= scale
  }
  state.body.velocity.y = clamp(state.body.velocity.y, -DRONE_MAX_SPEED_MPS * 0.82, DRONE_MAX_SPEED_MPS * 0.82)
  if (state.maxPostCollisionVerticalVelocity !== null) {
    state.body.velocity.y = Math.min(state.body.velocity.y, state.maxPostCollisionVerticalVelocity)
  }
  state.body.angularVelocity.x = 0
  state.body.angularVelocity.y = 0
  state.body.angularVelocity.z = 0
}

function applyPropWashToObjects(
  draftBodies: DraftObjectBody[],
  droneBody: Body,
  profile: EffectiveBehaviorProfile,
  dt: number,
  time: number,
  seed: number,
) {
  if (profile.objectDraftStrength <= 0 && profile.propWashStrength <= 0) {
    return
  }

  for (const draft of draftBodies) {
    const offset = draft.body.position.vsub(droneBody.position)
    const horizontalDistance = Math.hypot(offset.x, offset.z)
    const verticalOffset = droneBody.position.y - draft.body.position.y
    const wakeRadius = 0.7 + profile.objectDraftStrength * 0.45 + profile.propWashStrength * 0.2
    const inWake =
      horizontalDistance < wakeRadius &&
      verticalOffset > -0.12 &&
      verticalOffset < 1.05

    if (inWake) {
      const outward = new Vec3(offset.x, 0, offset.z)
      if (outward.length() > 0.0001) {
        outward.normalize()
      } else {
        outward.set(1, 0, 0)
      }
      const swirl = new Vec3(-outward.z, 0, outward.x)
      const falloff =
        (1 - horizontalDistance / wakeRadius) *
        (1 - Math.max(verticalOffset, 0) / 1.05)
      const pulse = 1 + Math.sin(time * 7.6 + seed * 0.21 + horizontalDistance * 4.4) * 0.18
      const draftStrength =
        falloff *
        pulse *
        (profile.objectDraftStrength * 0.3 + profile.propWashStrength * 0.12)
      const mass = Math.max(draft.body.mass, 0.01)
      draft.body.velocity.x += ((outward.x * draftStrength) + swirl.x * draftStrength * 0.24) * dt / mass
      draft.body.velocity.z += ((outward.z * draftStrength) + swirl.z * draftStrength * 0.24) * dt / mass
      draft.body.angularVelocity.y += draftStrength * 0.8
    }

    draft.body.position.y = draft.anchorY
    draft.body.velocity.y = 0
    draft.body.angularVelocity.x = 0
    draft.body.angularVelocity.z = 0
  }
}

function getMissionCheckpoints(layout: FieldLayout): MissionCheckpoint[] {
  return [...layout.missionCheckpoints].sort((left, right) => left.order - right.order)
}

function getCollidableObjects(layout: FieldLayout): FieldObject[] {
  return layout.objects.filter((object) => object.isSolid || object.type === 'wall' || object.type === 'boundary')
}

function getOrCreateArray<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey): TValue[] {
  const existing = map.get(key)
  if (existing) {
    return existing
  }

  const created: TValue[] = []
  map.set(key, created)
  return created
}

function getOrCreateSet<TKey>(map: Map<TKey, Set<string>>, key: TKey): Set<string> {
  const existing = map.get(key)
  if (existing) {
    return existing
  }

  const created = new Set<string>()
  map.set(key, created)
  return created
}

function markCheckpointResult(
  results: CheckpointResult[],
  checkpointId: string,
  status: CheckpointResult['status'],
  time: number | null,
) {
  const target = results.find((result) => result.checkpointId === checkpointId)
  if (!target) {
    return
  }

  target.status = status
  target.hitTime = time
  target.completed = status === 'hit'
  target.completedTime = status === 'hit' ? time : null
  target.invalidated = status === 'skipped' || status === 'outOfOrder' || status === 'invalidated'
}

function buildCheckpointMessage(prefix: string, checkpoint: MissionCheckpoint, object?: FieldObject): string {
  return `${prefix} Checkpoint ${checkpoint.order} (${checkpoint.label ?? object?.name ?? checkpoint.objectId}).`
}

function buildLandingResult(
  point: Vector3,
  objects: FieldObject[],
  completedCheckpointIds: Set<string>,
  checkpoints: MissionCheckpoint[],
): { landingResult: LandingResult; invalidReason: string | null } {
  const landingSurface = resolveLandingSurface(point, objects)
  const requiredRemaining = checkpoints.filter(
    (checkpoint) => checkpoint.required && !completedCheckpointIds.has(checkpoint.id) && checkpoint.passCondition !== 'landOn',
  )
  const landedOnRecognizedSurface = landingSurface.surface !== 'none'

  if (requiredRemaining.length > 0) {
    return {
      landingResult: {
        surface: landingSurface.surface,
        objectId: landingSurface.objectId,
        valid: false,
        atTime: null,
        message: `Landed before completing required checkpoints: ${requiredRemaining.map((checkpoint) => checkpoint.label).join(', ')}.`,
      },
      invalidReason: `Missed required checkpoints before landing: ${requiredRemaining.map((checkpoint) => checkpoint.label).join(', ')}`,
    }
  }

  if (!landedOnRecognizedSurface) {
    return {
      landingResult: {
        surface: 'none',
        objectId: null,
        valid: false,
        atTime: null,
        message: 'Landing completed off a recognized scoring surface.',
      },
      invalidReason: 'Landing did not finish on a valid landing surface.',
    }
  }

  return {
    landingResult: {
      surface: landingSurface.surface,
      objectId: landingSurface.objectId,
      valid: true,
      atTime: null,
      message:
        landingSurface.surface === 'bullseye'
          ? 'Valid landing on the landing pad bullseye.'
          : `Valid landing on ${landingSurface.surface}.`,
    },
    invalidReason: null,
  }
}

function classifyCollisionSeverity(
  peakSpeed: number,
  durationSeconds: number,
  rawContactCount: number,
  peakContactCount: number,
  maxApproach: number,
): CollisionSeverity {
  const severityScore =
    peakSpeed * 0.016 +
    durationSeconds * 22 +
    rawContactCount * 0.45 +
    peakContactCount * 1.1 +
    maxApproach * 16

  if (severityScore >= 10.8) {
    return 'hard'
  }
  if (severityScore >= 5.4) {
    return 'bump'
  }
  return 'brush'
}

function buildCollisionMessage(
  severity: CollisionSeverity,
  objectName: string,
  rawContactCount: number,
  contactType: DroneProxyContactType,
): string {
  const label =
    severity === 'hard'
      ? 'Hard collision'
      : severity === 'bump'
        ? 'Collision bump'
        : 'Collision brush'
  return `${label} with ${objectName} (${contactType}, ${rawContactCount} raw contacts).`
}

function normalizeVector(vector: Vector3, fallback: Vector3 = { x: 0, y: 0, z: 1 }): Vector3 {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z)
  if (magnitude <= 0.0001) {
    return fallback
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  }
}

function averageVector(points: Vector3[]): Vector3 {
  if (points.length === 0) {
    return { x: 0, y: 0, z: 0 }
  }
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
      z: sum.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  )
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  }
}

function mergeRepresentativeNormal(current: Vector3, next: Vector3): Vector3 {
  return normalizeVector({
    x: current.x + next.x,
    y: current.y + next.y,
    z: current.z + next.z,
  })
}

function applyCollisionAftermath(
  state: DroneSimState,
  severity: CollisionSeverity,
  contactNormal: Vector3,
): void {
  const velocity = {
    x: state.body.velocity.x,
    y: state.body.velocity.y,
    z: state.body.velocity.z,
  }
  const normal = normalizeVector(contactNormal, {
    x: -Math.cos(degreesToRadians(state.heading)),
    y: 0,
    z: -Math.sin(degreesToRadians(state.heading)),
  })
  const normalVelocity =
    velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z
  const tangentVelocity = {
    x: velocity.x - normal.x * normalVelocity,
    y: velocity.y - normal.y * normalVelocity,
    z: velocity.z - normal.z * normalVelocity,
  }
  const tangentRetain = severity === 'hard' ? 0.62 : severity === 'bump' ? 0.76 : 0.9
  const outwardBounce = Math.max(-normalVelocity, 0) * (severity === 'hard' ? 0.14 : 0.08)
  const nextVelocity = {
    x: tangentVelocity.x * tangentRetain + normal.x * outwardBounce,
    y: tangentVelocity.y * tangentRetain + normal.y * outwardBounce,
    z: tangentVelocity.z * tangentRetain + normal.z * outwardBounce,
  }

  if (normal.y < 0.45) {
    const upwardVelocityLimit =
      severity === 'hard' ? 0.16 : severity === 'bump' ? 0.12 : 0.08
    const cappedVerticalVelocity = Math.min(velocity.y, upwardVelocityLimit)
    state.maxPostCollisionVerticalVelocity = cappedVerticalVelocity
    nextVelocity.y = Math.min(nextVelocity.y, cappedVerticalVelocity)
  } else {
    state.maxPostCollisionVerticalVelocity = null
  }

  state.collisionSurfaceNormal = normal
  state.body.velocity.set(nextVelocity.x, nextVelocity.y, nextVelocity.z)
}

function buildPose(position: Vector3, heading: number, airborne: boolean) {
  return {
    position,
    heading,
    airborne,
  }
}

function simulateCore(
  plannedSegments: PlannedSegment[],
  behaviorProfile: BehaviorProfile,
  fieldLayout: FieldLayout,
  seed: number,
  includeEstimate: boolean,
): SimulationRun {
  if (plannedSegments.length === 0) {
    return {
      id: createId('run'),
      routeVersionId: createId('route'),
      behaviorProfileId: behaviorProfile.id,
      fieldLayoutId: fieldLayout.id,
      seed,
      createdAt: new Date().toISOString(),
      plannedSegments,
      segments: [],
      trace: [],
      failureMarkers: [],
      collisionEvents: [],
      checkpointResults: [],
      completedCheckpointIds: [],
      skippedCheckpointIds: [],
      invalidCheckpointIds: [],
      routeInvalidReason: null,
      landingResult: {
        surface: 'none',
        objectId: null,
        valid: true,
        atTime: null,
        message: 'No landing required.',
      },
      contactedObjectIds: [],
      missedObjectIds: [],
      metrics: {
        totalTime: 0,
        instructionCount: 0,
        turnCount: 0,
        collisionCount: 0,
        pathDeviation: 0,
        checkpointHits: 0,
        checkpointTargetCount: 0,
        riskPoints: 0,
        efficiencyScore: 100,
        consistencyScore: 100,
        completionSuccessEstimate: 100,
        routeValid: true,
        routeInvalidReason: null,
        landingResult: {
          surface: 'none',
          objectId: null,
          valid: true,
          atTime: null,
          message: 'No landing required.',
        },
      },
      solveSummary: {
        seed,
        physicsSteps: 0,
        tracePoints: 0,
        checkpointChecks: 0,
        monteCarloRuns: 0,
        solveTimeMs: 0,
        averageNoiseMagnitude: 0,
        driftAccumulation: 0,
      },
    }
  }

  const random = createSeededRandom(seed)
  const actualProfile = buildEffectiveProfile(behaviorProfile, random)
  const plannedProfile = buildPlannedProfile(behaviorProfile)
  const actualWindows = buildRuntimeWindows(plannedSegments, actualProfile, random, true)
  const plannedWindows = buildRuntimeWindows(plannedSegments, plannedProfile, random, false)
  const collidableObjects = getCollidableObjects(fieldLayout)
  const missionCheckpoints = getMissionCheckpoints(fieldLayout)
  const checkpointResults = createCheckpointResults(missionCheckpoints, fieldLayout.objects)
  const failureMarkers: FailureMarker[] = []
  const collisionEvents: CollisionEvent[] = []
  const trace: SimulationTracePoint[] = []
  const collisionIds = new Set<string>()
  const contactedObjectIds = new Set<string>()
  const missedObjectIds = new Set<string>()
  const completedCheckpointIds = new Set<string>()
  const skippedCheckpointIds = new Set<string>()
  const invalidCheckpointIds = new Set<string>()

  const actualWorld = createWorld(fieldLayout, actualProfile, true)
  const plannedWorld = createWorld(fieldLayout, plannedProfile, false)
  const actualState: DroneSimState = {
    body: actualWorld.body,
    heading: fieldLayout.spawn.heading,
    holdAltitudeMeters: toMeters(fieldLayout.spawn.position.y),
    pitch: 0,
    roll: 0,
    yawRateDegS: 0,
    disturbanceHorizontal: { x: 0, y: 0, z: 0 },
    disturbanceVerticalMps: 0,
    disturbanceYawDegS: 0,
    disturbanceMagnitude: 0,
    lastHorizontalCommand: { x: 0, y: 0, z: 0 },
    coastVelocity: { x: 0, y: 0, z: 0 },
    coastTimer: 0,
    coastDuration: 0,
    isCoasting: false,
    wasCommandingHorizontal: false,
    collisionAftershock: 0,
    maxPostCollisionVerticalVelocity: null,
    collisionSurfaceNormal: null,
  }
  const plannedState: DroneSimState = {
    body: plannedWorld.body,
    heading: fieldLayout.spawn.heading,
    holdAltitudeMeters: toMeters(fieldLayout.spawn.position.y),
    pitch: 0,
    roll: 0,
    yawRateDegS: 0,
    disturbanceHorizontal: { x: 0, y: 0, z: 0 },
    disturbanceVerticalMps: 0,
    disturbanceYawDegS: 0,
    disturbanceMagnitude: 0,
    lastHorizontalCommand: { x: 0, y: 0, z: 0 },
    coastVelocity: { x: 0, y: 0, z: 0 },
    coastTimer: 0,
    coastDuration: 0,
    isCoasting: false,
    wasCommandingHorizontal: false,
    collisionAftershock: 0,
    maxPostCollisionVerticalVelocity: null,
    collisionSurfaceNormal: null,
  }

  const plannedPointsBySegment = new Map<string, Vector3[]>()
  const actualPointsBySegment = new Map<string, Vector3[]>()
  const plannedCheckpointHitsBySegment = new Map<string, Set<string>>()
  const actualCheckpointHitsBySegment = new Map<string, Set<string>>()
  const collisionsBySegment = new Map<string, Set<string>>()
  const skippedBySegment = new Map<string, Set<string>>()
  const outOfOrderBySegment = new Map<string, Set<string>>()
  const riskFlagsBySegment = new Map<string, Set<string>>()
  let expectedCheckpointIndex = 0
  let actualContactSet = new Set<string>()
  let plannedContactSet = new Set<string>()
  let physicsSteps = 0
  let checkpointChecks = 0
  let accumulatedNoiseMagnitude = 0
  let accumulatedDrift = 0
  let driftSamples = 0
  const activeCollisionEvents = new Map<string, ActiveCollisionEvent>()
  let landingResult: LandingResult = {
    surface: 'none',
    objectId: null,
    valid: true,
    atTime: null,
    message: 'Landing not yet evaluated.',
  }
  let routeInvalidReason: string | null = null
  const totalTime =
    Math.max(actualWindows.at(-1)?.end ?? 0, plannedWindows.at(-1)?.end ?? 0) +
    PHYSICS_SETTLE_SECONDS

  const finalizeCollisionEvent = (event: ActiveCollisionEvent) => {
    const durationSeconds = Math.max(event.lastContactTime - event.firstContactTime, 0)
    const severity = classifyCollisionSeverity(
      event.peakSpeed,
      durationSeconds,
      event.rawContactCount,
      event.peakContactCount,
      event.maxApproach,
    )
    const contactType =
      severity === 'hard' && event.contactType === 'bodyHit'
        ? 'hardStop'
        : event.contactType
    collisionEvents.push({
      id: event.eventId,
      objectId: event.objectId,
      objectName: event.objectName,
      instructionId: event.instructionId,
      segmentId: event.segmentId,
      firstContactTime: event.firstContactTime,
      lastContactTime: event.lastContactTime,
      contactCount: event.contactCount,
      rawContactCount: event.rawContactCount,
      severity,
      peakSpeed: event.peakSpeed,
      position: event.representativeContactPoint,
      representativeContactPoint: event.representativeContactPoint,
      representativeNormal: event.representativeNormal,
      contactType,
    })
    failureMarkers.push(
      buildFailureMarker(
        event.instructionId,
        'collision',
        buildCollisionMessage(severity, event.objectName, event.rawContactCount, contactType),
        event.representativeContactPoint,
        event.firstContactTime,
        {
          severity,
          rawContactCount: event.rawContactCount,
          contactType,
          normal: event.representativeNormal,
        },
      ),
    )
    if (event.segmentId) {
      getOrCreateSet(collisionsBySegment, event.segmentId).add(event.objectId)
      if (severity === 'hard') {
        getOrCreateSet(riskFlagsBySegment, event.segmentId).add('Hard collision event')
      } else if (severity === 'bump') {
        getOrCreateSet(riskFlagsBySegment, event.segmentId).add('Moderate collision event')
      }
    }
  }

  for (let time = 0; time <= totalTime + 0.0001; time += PHYSICS_STEP_SECONDS) {
    physicsSteps += 1
    const actualIntent = resolveIntent(actualWindows, time, actualState.heading)
    const plannedIntent = resolveIntent(plannedWindows, time, plannedState.heading)
    applyDroneControl(plannedState, plannedProfile, plannedIntent, PHYSICS_STEP_SECONDS, time, seed + 17)
    applyDroneControl(
      actualState,
      actualProfile,
      actualIntent,
      PHYSICS_STEP_SECONDS,
      time,
      seed,
      {
        positionMeters: plannedState.body.position.clone(),
        velocityMetersPerSecond: plannedState.body.velocity.clone(),
        heading: plannedState.heading,
      },
      random,
    )
    applyPropWashToObjects(
      actualWorld.draftBodies,
      actualState.body,
      actualProfile,
      PHYSICS_STEP_SECONDS,
      time,
      seed,
    )
    stepPhysicsWorld({ world: actualWorld.world }, PHYSICS_STEP_SECONDS)
    stepPhysicsWorld({ world: plannedWorld.world }, PHYSICS_STEP_SECONDS)

    for (const draft of actualWorld.draftBodies) {
      draft.body.position.y = draft.anchorY
      draft.body.velocity.y = 0
    }

    setBodyToYawOnly(actualState.body, actualState.heading)
    setBodyToYawOnly(plannedState.body, plannedState.heading)

    const actualPosition = vec3FromMeters(actualState.body.position)
    const plannedPosition = vec3FromMeters(plannedState.body.position)
    const actualSpeed = toCentimeters(
      Math.hypot(
        actualState.body.velocity.x,
        actualState.body.velocity.y,
        actualState.body.velocity.z,
      ),
    )
    const plannedSpeed = toCentimeters(
      Math.hypot(
        plannedState.body.velocity.x,
        plannedState.body.velocity.y,
        plannedState.body.velocity.z,
      ),
    )
    accumulatedNoiseMagnitude += actualState.disturbanceMagnitude
    accumulatedDrift += distanceBetween(actualPosition, plannedPosition)
    driftSamples += 1

    if (actualIntent.primarySegmentId) {
      getOrCreateArray(actualPointsBySegment, actualIntent.primarySegmentId).push(actualPosition)
    }
    if (plannedIntent.primarySegmentId) {
      getOrCreateArray(plannedPointsBySegment, plannedIntent.primarySegmentId).push(plannedPosition)
    }

    const actualCheckpointContacts = new Set(
      missionCheckpoints
        .filter((checkpoint) => {
          const object = fieldLayout.objects.find((candidate) => candidate.id === checkpoint.objectId)
          return object ? checkpointSatisfied(actualPosition, object, checkpoint) : false
        })
        .map((checkpoint) => checkpoint.id),
    )
    const plannedCheckpointContacts = new Set(
      missionCheckpoints
        .filter((checkpoint) => {
          const object = fieldLayout.objects.find((candidate) => candidate.id === checkpoint.objectId)
          return object ? checkpointSatisfied(plannedPosition, object, checkpoint) : false
        })
        .map((checkpoint) => checkpoint.id),
    )
    checkpointChecks += missionCheckpoints.length * 2

    for (const checkpointId of plannedCheckpointContacts) {
      if (plannedContactSet.has(checkpointId)) {
        continue
      }
      if (plannedIntent.primarySegmentId) {
        getOrCreateSet(plannedCheckpointHitsBySegment, plannedIntent.primarySegmentId).add(
          checkpointId,
        )
      }
    }

    for (const checkpointId of actualCheckpointContacts) {
      if (actualContactSet.has(checkpointId)) {
        continue
      }

      const checkpoint = missionCheckpoints.find((candidate) => candidate.id === checkpointId)
      if (!checkpoint) {
        continue
      }
      const checkpointObject = fieldLayout.objects.find((candidate) => candidate.id === checkpoint.objectId)
      if (!checkpointObject) {
        continue
      }

      contactedObjectIds.add(checkpoint.objectId)
      if (actualIntent.primarySegmentId) {
        getOrCreateSet(actualCheckpointHitsBySegment, actualIntent.primarySegmentId).add(
          checkpoint.id,
        )
      }

      const checkpointIndex = missionCheckpoints.findIndex((candidate) => candidate.id === checkpointId)
      if (checkpointIndex > expectedCheckpointIndex) {
        for (let index = expectedCheckpointIndex; index < checkpointIndex; index += 1) {
          const skippedCheckpoint = missionCheckpoints[index]
          const skippedObject = fieldLayout.objects.find((candidate) => candidate.id === skippedCheckpoint.objectId)
          if (
            completedCheckpointIds.has(skippedCheckpoint.id) ||
            skippedCheckpointIds.has(skippedCheckpoint.id) ||
            !skippedCheckpoint.required
          ) {
            continue
          }

          skippedCheckpointIds.add(skippedCheckpoint.id)
          invalidCheckpointIds.add(skippedCheckpoint.id)
          missedObjectIds.add(skippedCheckpoint.objectId)
          markCheckpointResult(checkpointResults, skippedCheckpoint.id, 'skipped', null)
          if (actualIntent.primarySegmentId) {
            getOrCreateSet(skippedBySegment, actualIntent.primarySegmentId).add(
              skippedCheckpoint.id,
            )
          }
          failureMarkers.push(
            buildFailureMarker(
              actualIntent.primaryInstructionId,
              'checkpoint',
              buildCheckpointMessage('Skipped required', skippedCheckpoint, skippedObject ?? undefined),
              skippedObject?.position ?? actualPosition,
              time,
            ),
          )
        }

        invalidCheckpointIds.add(checkpoint.id)
        markCheckpointResult(checkpointResults, checkpoint.id, 'outOfOrder', time)
        if (actualIntent.primarySegmentId) {
          getOrCreateSet(outOfOrderBySegment, actualIntent.primarySegmentId).add(checkpoint.id)
        }
        failureMarkers.push(
          buildFailureMarker(
            actualIntent.primaryInstructionId,
            'checkpoint',
            buildCheckpointMessage('Entered out of order', checkpoint, checkpointObject),
            checkpointObject.position,
            time,
          ),
        )
      } else {
        markCheckpointResult(checkpointResults, checkpoint.id, 'hit', time)
      }

      completedCheckpointIds.add(checkpoint.id)
      expectedCheckpointIndex = Math.max(expectedCheckpointIndex, checkpointIndex + 1)
    }

    const currentCollisionContacts = new Map<string, CollisionContactCluster>()
    for (const contact of actualWorld.world.contacts) {
      const droneIsBodyA = contact.bi.id === actualState.body.id
      const droneIsBodyB = contact.bj.id === actualState.body.id
      if (!droneIsBodyA && !droneIsBodyB) {
        continue
      }

      const obstacleBodyId = droneIsBodyA ? contact.bj.id : contact.bi.id
      const obstacleId = actualWorld.obstacleBodyIds.get(obstacleBodyId)
      if (!obstacleId) {
        continue
      }

      const object = collidableObjects.find((candidate) => candidate.id === obstacleId)
      if (!object) {
        continue
      }

      const dronePointMeters = droneIsBodyA
        ? {
            x: actualState.body.position.x + contact.ri.x,
            y: actualState.body.position.y + contact.ri.y,
            z: actualState.body.position.z + contact.ri.z,
          }
        : {
            x: actualState.body.position.x + contact.rj.x,
            y: actualState.body.position.y + contact.rj.y,
            z: actualState.body.position.z + contact.rj.z,
          }
      const obstaclePointMeters = droneIsBodyA
        ? {
            x: contact.bj.position.x + contact.rj.x,
            y: contact.bj.position.y + contact.rj.y,
            z: contact.bj.position.z + contact.rj.z,
          }
        : {
            x: contact.bi.position.x + contact.ri.x,
            y: contact.bi.position.y + contact.ri.y,
            z: contact.bi.position.z + contact.ri.z,
          }
      const rawObstacleContactPoint = vec3FromMeters(obstaclePointMeters as Vec3)
      const refinedObstaclePoint = projectPointToObjectSurface(rawObstacleContactPoint, object)
      const obstacleContactPoint =
        distanceBetween(rawObstacleContactPoint, refinedObstaclePoint) > 10
          ? refinedObstaclePoint
          : rawObstacleContactPoint
      const rawDroneContactPoint = {
        x: toCentimeters(dronePointMeters.x),
        y: toCentimeters(dronePointMeters.y),
        z: toCentimeters(dronePointMeters.z),
      }
      const representativeContactPoint = averageVector([
        rawDroneContactPoint,
        obstacleContactPoint,
      ])
      const geometricNormal = normalizeVector({
        x: rawDroneContactPoint.x - obstacleContactPoint.x,
        y: rawDroneContactPoint.y - obstacleContactPoint.y,
        z: rawDroneContactPoint.z - obstacleContactPoint.z,
      })
      const physicsNormal = normalizeVector(
        droneIsBodyA
          ? {
              x: -contact.ni.x,
              y: -contact.ni.y,
              z: -contact.ni.z,
            }
          : {
              x: contact.ni.x,
              y: contact.ni.y,
              z: contact.ni.z,
            },
        geometricNormal,
      )
      const representativeNormal = normalizeVector(
        {
          x: physicsNormal.x * 0.85 + geometricNormal.x * 0.15,
          y: physicsNormal.y * 0.85 + geometricNormal.y * 0.15,
          z: physicsNormal.z * 0.85 + geometricNormal.z * 0.15,
        },
        geometricNormal,
      )
      const droneLocalPoint = toDroneLocalPoint(
        dronePointMeters as unknown as Vector3,
        {
          x: actualState.body.position.x,
          y: actualState.body.position.y,
          z: actualState.body.position.z,
        },
        actualState.heading,
      )

      const toObstacle = {
        x: object.position.x - actualPosition.x,
        y: object.position.y - actualPosition.y,
        z: object.position.z - actualPosition.z,
      }
      const toObstacleLength = Math.hypot(toObstacle.x, toObstacle.y, toObstacle.z)
      const bodyVelocityLength = Math.max(actualState.body.velocity.length(), 0.0001)
      const velocityNorm = {
        x: actualState.body.velocity.x / bodyVelocityLength,
        y: actualState.body.velocity.y / bodyVelocityLength,
        z: actualState.body.velocity.z / bodyVelocityLength,
      }
      const obstacleNorm =
        toObstacleLength > 0.0001
          ? {
              x: toObstacle.x / toObstacleLength,
              y: toObstacle.y / toObstacleLength,
              z: toObstacle.z / toObstacleLength,
            }
          : { x: 0, y: 0, z: 0 }
      const approach = Math.max(
        0,
        velocityNorm.x * obstacleNorm.x +
          velocityNorm.y * obstacleNorm.y +
          velocityNorm.z * obstacleNorm.z,
      )

      const existingCluster = currentCollisionContacts.get(obstacleId)
      if (existingCluster) {
        existingCluster.rawContactCount += 1
        existingCluster.peakSpeed = Math.max(existingCluster.peakSpeed, actualSpeed)
        existingCluster.maxApproach = Math.max(existingCluster.maxApproach, approach)
        existingCluster.peakContactCount = Math.max(existingCluster.peakContactCount, existingCluster.rawContactCount)
        existingCluster.representativeContactPoint = averageVector([
          existingCluster.representativeContactPoint,
          representativeContactPoint,
        ])
        existingCluster.representativeNormal = mergeRepresentativeNormal(
          existingCluster.representativeNormal,
          representativeNormal,
        )
        if (existingCluster.contactType === 'bodyHit') {
          existingCluster.contactType = classifyDroneContactType(
            droneLocalPoint,
            'bump',
            approach,
          )
        }
        continue
      }

      currentCollisionContacts.set(obstacleId, {
        objectId: obstacleId,
        rawContactCount: 1,
        peakSpeed: actualSpeed,
        maxApproach: approach,
        peakContactCount: 1,
        representativeContactPoint,
        representativeNormal,
        contactType: classifyDroneContactType(droneLocalPoint, 'brush', approach),
      })
    }

    const currentCollisionIds = new Set(currentCollisionContacts.keys())
    for (const [collisionId, cluster] of currentCollisionContacts) {
      const object = collidableObjects.find((candidate) => candidate.id === collisionId)
      if (!object) {
        continue
      }
      const existingEvent = activeCollisionEvents.get(collisionId)
      const mergeDistance = Math.max(
        COLLISION_MERGE_DISTANCE_CM,
        Math.max(object.size.x, object.size.z) * 0.4,
      )
      const canMerge =
        existingEvent &&
        (
          time - existingEvent.lastContactTime <= COLLISION_COOLDOWN_SECONDS ||
          (
            time - existingEvent.lastContactTime <= COLLISION_COOLDOWN_SECONDS * 1.5 &&
            distanceBetween(existingEvent.representativeContactPoint, cluster.representativeContactPoint) <=
              mergeDistance
          )
        )

      if (existingEvent && canMerge) {
        existingEvent.lastContactTime = time
        existingEvent.contactCount += 1
        existingEvent.rawContactCount += cluster.rawContactCount
        existingEvent.peakSpeed = Math.max(existingEvent.peakSpeed, cluster.peakSpeed)
        existingEvent.maxApproach = Math.max(existingEvent.maxApproach, cluster.maxApproach)
        existingEvent.peakContactCount = Math.max(existingEvent.peakContactCount, cluster.peakContactCount)
        existingEvent.representativeContactPoint = averageVector([
          existingEvent.representativeContactPoint,
          cluster.representativeContactPoint,
        ])
        existingEvent.representativeNormal = mergeRepresentativeNormal(
          existingEvent.representativeNormal,
          cluster.representativeNormal,
        )
        if (existingEvent.contactType !== 'hardStop' && cluster.contactType === 'hardStop') {
          existingEvent.contactType = 'hardStop'
        } else if (existingEvent.contactType === 'bodyHit' && cluster.contactType !== 'bodyHit') {
          existingEvent.contactType = cluster.contactType
        }
      } else {
        if (existingEvent) {
          finalizeCollisionEvent(existingEvent)
        }

        const severitySeed = classifyCollisionSeverity(
          cluster.peakSpeed,
          0,
          cluster.rawContactCount,
          cluster.peakContactCount,
          cluster.maxApproach,
        )
        const pushScale = COLLISION_PUSH_SCALE[severitySeed]
        applyCollisionAftermath(actualState, severitySeed, cluster.representativeNormal)
        actualState.body.velocity.x += cluster.representativeNormal.x * pushScale
        actualState.body.velocity.z += cluster.representativeNormal.z * pushScale
        actualState.collisionAftershock = Math.max(
          actualState.collisionAftershock,
          COLLISION_AFTERSHOCK_SECONDS * COLLISION_AFTERSHOCK_MULTIPLIER[severitySeed],
        )
        collisionIds.add(collisionId)
        activeCollisionEvents.set(collisionId, {
          eventId: createId('collision'),
          objectId: collisionId,
          objectName: object.name,
          instructionId: actualIntent.primaryInstructionId,
          segmentId: actualIntent.primarySegmentId,
          firstContactTime: time,
          lastContactTime: time,
          contactCount: 1,
          rawContactCount: cluster.rawContactCount,
          peakSpeed: cluster.peakSpeed,
          maxApproach: cluster.maxApproach,
          peakContactCount: cluster.peakContactCount,
          representativeContactPoint: cluster.representativeContactPoint,
          representativeNormal: cluster.representativeNormal,
          contactType: cluster.contactType === 'grazingContact' && severitySeed !== 'brush'
            ? 'armBrush'
            : severitySeed === 'hard' && cluster.contactType === 'bodyHit'
              ? 'hardStop'
              : cluster.contactType,
        })
      }
    }

    for (const [collisionId, event] of [...activeCollisionEvents.entries()]) {
      if (currentCollisionIds.has(collisionId)) {
        continue
      }
      if (time - event.lastContactTime > COLLISION_COOLDOWN_SECONDS) {
        finalizeCollisionEvent(event)
        activeCollisionEvents.delete(collisionId)
      }
    }

    if (actualIntent.primarySegmentId) {
      const clearanceRisk = collidableObjects.some(
        (object) => distanceToObject(actualPosition, object) < 18,
      )
      if (clearanceRisk) {
        getOrCreateSet(riskFlagsBySegment, actualIntent.primarySegmentId).add(
          'Tight obstacle clearance',
        )
      }
      if (Math.abs(actualState.pitch) > 0.3 || Math.abs(actualState.roll) > 0.3) {
        getOrCreateSet(riskFlagsBySegment, actualIntent.primarySegmentId).add(
          'Aggressive tilt response',
        )
      }
    }

    const primaryWindow = getPrimaryWindow(actualWindows, time) ?? actualWindows.at(-1)
    const normalizedTime = primaryWindow
      ? plannedSegments.findIndex((segment) => segment.id === primaryWindow.segment.id) +
        clamp(
          (time - primaryWindow.start) /
            Math.max(primaryWindow.end - primaryWindow.start, 0.001),
          0,
          1,
        )
      : 0

    trace.push({
      time,
      normalizedTime,
      instructionId: primaryWindow?.segment.instructionId ?? plannedSegments[0].instructionId,
      segmentId: primaryWindow?.segment.id ?? plannedSegments[0].id,
      dynamicObjectPositions: Object.fromEntries(
        actualWorld.draftBodies.map((draft) => [
          draft.objectId,
          vec3FromMeters(draft.body.position),
        ]),
      ),
      dynamicObjects: actualWorld.draftBodies.map((draft) => ({
        objectId: draft.objectId,
        position: vec3FromMeters(draft.body.position),
        rotation: getRotationFromBody(draft.body),
      })),
      plannedPosition,
      actualPosition,
      plannedHeading: plannedState.heading,
      actualHeading: actualState.heading,
      plannedSpeed,
      actualSpeed,
      plannedPitch: plannedState.pitch,
      plannedRoll: plannedState.roll,
      actualPitch: actualState.pitch,
      actualRoll: actualState.roll,
    })

    actualContactSet = actualCheckpointContacts
    plannedContactSet = plannedCheckpointContacts
  }

  for (let index = expectedCheckpointIndex; index < missionCheckpoints.length; index += 1) {
    const checkpoint = missionCheckpoints[index]
    const checkpointObject = fieldLayout.objects.find((candidate) => candidate.id === checkpoint.objectId)
    if (completedCheckpointIds.has(checkpoint.id) || skippedCheckpointIds.has(checkpoint.id)) {
      continue
    }
    if (!checkpoint.required) {
      continue
    }

    skippedCheckpointIds.add(checkpoint.id)
    invalidCheckpointIds.add(checkpoint.id)
    missedObjectIds.add(checkpoint.objectId)
    markCheckpointResult(checkpointResults, checkpoint.id, 'skipped', null)
    failureMarkers.push(
      buildFailureMarker(
        plannedSegments.at(-1)?.instructionId ?? createId('instruction'),
        'checkpoint',
        buildCheckpointMessage('Route ended before reaching', checkpoint, checkpointObject ?? undefined),
        checkpointObject?.position ?? fieldLayout.spawn.position,
        totalTime,
      ),
    )
  }

  for (const event of activeCollisionEvents.values()) {
    finalizeCollisionEvent(event)
  }
  activeCollisionEvents.clear()

  const includesLanding = plannedSegments.some((segment) => segment.kind === 'land')
  if (includesLanding) {
    const landingEvaluation = buildLandingResult(
      trace.at(-1)?.actualPosition ?? fieldLayout.spawn.position,
      fieldLayout.objects,
      completedCheckpointIds,
      missionCheckpoints,
    )
    landingResult = {
      ...landingEvaluation.landingResult,
      atTime: trace.at(-1)?.time ?? totalTime,
    }
    routeInvalidReason = landingEvaluation.invalidReason

    if (!landingResult.valid) {
      failureMarkers.push(
        buildFailureMarker(
          plannedSegments.at(-1)?.instructionId ?? createId('instruction'),
          'landing',
          landingResult.message,
          trace.at(-1)?.actualPosition ?? fieldLayout.spawn.position,
          trace.at(-1)?.time ?? totalTime,
        ),
      )
    }
  }

  const segments: SimulationSegmentResult[] = plannedSegments.map((segment) => {
    const actualWindow = actualWindows.find((window) => window.segment.id === segment.id)
    const actualEndTrace = getTracePointAtTime(trace, actualWindow?.end ?? segment.scheduledEnd)
    const actualPoints = actualPointsBySegment.get(segment.id) ?? [
      actualEndTrace?.actualPosition ?? segment.endPose.position,
    ]
    const plannedPoints = plannedPointsBySegment.get(segment.id) ?? segment.plannedPoints
    const comparisonLength = Math.min(actualPoints.length, plannedPoints.length)
    const deviation =
      comparisonLength > 0
        ? actualPoints.slice(0, comparisonLength).reduce((sum, point, index) => {
            const plannedPoint = plannedPoints[index]
            return sum + distanceBetween(point, plannedPoint)
          }, 0) / comparisonLength
        : 0

    const checkpointHits = [
      ...(actualCheckpointHitsBySegment.get(segment.id) ?? new Set<string>()),
    ]
    const plannedHits = [
      ...(plannedCheckpointHitsBySegment.get(segment.id) ?? new Set<string>()),
    ]
    const collisions = [...(collisionsBySegment.get(segment.id) ?? new Set<string>())]
    const skipped = [...(skippedBySegment.get(segment.id) ?? new Set<string>())]
    const outOfOrder = [...(outOfOrderBySegment.get(segment.id) ?? new Set<string>())]
    const riskFlags = [...(riskFlagsBySegment.get(segment.id) ?? new Set<string>())]

    if (collisions.length > 0) {
      riskFlags.push('Solid contact event')
    }
    if (deviation > 12) {
      riskFlags.push('High path deviation')
    }

    return {
      id: createId('run-segment'),
      instructionId: segment.instructionId,
      instructionLabel: segment.instructionLabel,
      kind: segment.kind,
      plannedEnd: segment.endPose,
      actualEnd: buildPose(
        actualEndTrace?.actualPosition ?? segment.endPose.position,
        actualEndTrace?.actualHeading ?? segment.endPose.heading,
        (actualEndTrace?.actualPosition.y ?? segment.endPose.position.y) > 0.5,
      ),
      plannedDuration: segment.duration,
      actualDuration: Math.max(
        (actualWindow?.end ?? segment.scheduledEnd) -
          (actualWindow?.start ?? segment.scheduledStart),
        0,
      ),
      delayAfter: segment.delayAfter,
      deviation,
      collisions,
      checkpointHits,
      outOfOrderCheckpointIds: outOfOrder,
      skippedCheckpointIds: skipped,
      missedTargets: plannedHits.filter((objectId) => !checkpointHits.includes(objectId)),
      riskFlags,
      plannedPoints,
      actualPoints,
      startTime: actualWindow?.start ?? segment.scheduledStart,
      endTime: actualWindow?.end ?? segment.scheduledEnd,
    }
  })

  const collisionCount = collisionEvents.length
  const checkpointHits = checkpointResults.filter((checkpoint) => checkpoint.status === 'hit').length
  const checkpointTargetCount = checkpointResults.filter((checkpoint) => checkpoint.required).length
  const turnCount = segments.filter(
    (segment) => segment.kind === 'rotateCW' || segment.kind === 'rotateCCW',
  ).length
  const riskPoints = segments.reduce((sum, segment) => sum + segment.riskFlags.length, 0)
  const routeValid =
    collisionCount === 0 &&
    invalidCheckpointIds.size === 0 &&
    checkpointResults.every((checkpoint) => !checkpoint.required || checkpoint.status === 'hit') &&
    landingResult.valid

  const metrics: RunMetrics = {
    totalTime,
    instructionCount: segments.length,
    turnCount,
    collisionCount,
    pathDeviation: 0,
    checkpointHits,
    checkpointTargetCount,
    riskPoints,
    efficiencyScore: 0,
    consistencyScore: 0,
    completionSuccessEstimate: 0,
    routeValid,
    routeInvalidReason:
      routeInvalidReason ??
      (!routeValid ? 'Mission requirements were not fully satisfied.' : null),
    landingResult,
  }

  const run: SimulationRun = {
    id: createId('run'),
    routeVersionId: plannedSegments[0].routeVersionId,
    behaviorProfileId: behaviorProfile.id,
    fieldLayoutId: fieldLayout.id,
    seed,
    createdAt: new Date().toISOString(),
    plannedSegments,
    segments,
    trace,
    failureMarkers,
    collisionEvents,
    checkpointResults,
    completedCheckpointIds: [...completedCheckpointIds],
    skippedCheckpointIds: [...skippedCheckpointIds],
    invalidCheckpointIds: [...invalidCheckpointIds],
    routeInvalidReason: metrics.routeInvalidReason,
    landingResult,
    contactedObjectIds: [...contactedObjectIds],
    missedObjectIds: [...missedObjectIds],
    metrics,
    solveSummary: {
      seed,
      physicsSteps,
      tracePoints: trace.length,
      checkpointChecks,
      monteCarloRuns: 0,
      solveTimeMs: 0,
      averageNoiseMagnitude: driftSamples > 0 ? accumulatedNoiseMagnitude / driftSamples : 0,
      driftAccumulation: accumulatedDrift,
    },
  }

  run.metrics.pathDeviation = calculatePathDeviation(run)
  run.metrics.efficiencyScore = clamp(
    100 -
      run.metrics.totalTime * 3.8 -
      run.metrics.pathDeviation * 0.55 -
      run.metrics.collisionCount * 14 -
      invalidCheckpointIds.size * 10,
    5,
    100,
  )
  run.metrics.consistencyScore = clamp(
    100 -
      run.metrics.pathDeviation * 0.62 -
      riskPoints * 2.4 -
      actualProfile.speedVariationPct * 120 -
      actualProfile.dragPct * 38,
    5,
    100,
  )

  if (includeEstimate) {
    run.metrics.completionSuccessEstimate = estimateCompletionSuccess(
      plannedSegments,
      behaviorProfile,
      fieldLayout,
      MONTE_CARLO_RUNS,
    )
  }

  return run
}

function estimateCompletionSuccess(
  plannedSegments: PlannedSegment[],
  behaviorProfile: BehaviorProfile,
  fieldLayout: FieldLayout,
  sampleCount: number,
): number {
  let successCount = 0

  for (let index = 0; index < sampleCount; index += 1) {
    const run = simulateCore(plannedSegments, behaviorProfile, fieldLayout, index + 1, false)
    if (run.metrics.routeValid) {
      successCount += 1
    }
  }

  return Math.round((successCount / sampleCount) * 100)
}

export function simulateRoute(
  plannedSegments: PlannedSegment[],
  behaviorProfile: BehaviorProfile,
  fieldLayout: FieldLayout,
  seed: number,
): SimulationRun {
  return simulateCore(plannedSegments, behaviorProfile, fieldLayout, seed, false)
}

export function runDeepAnalysis(
  plannedSegments: PlannedSegment[],
  behaviorProfile: BehaviorProfile,
  fieldLayout: FieldLayout,
  baseSeed: number,
  sampleCount: number,
): DeepAnalysisResult {
  const runs: SimulationRun[] = []

  for (let index = 0; index < sampleCount; index += 1) {
    runs.push(simulateCore(plannedSegments, behaviorProfile, fieldLayout, baseSeed + index, false))
  }

  const successfulRuns = runs.filter((run) => run.metrics.routeValid).length
  const deviations = runs.map((run) => run.metrics.pathDeviation)
  const times = runs.map((run) => run.metrics.totalTime)
  const collisions = runs.map((run) => run.metrics.collisionCount)
  const averageDeviation =
    deviations.reduce((sum, value) => sum + value, 0) / Math.max(deviations.length, 1)
  const deviationVariance =
    deviations.reduce((sum, value) => sum + (value - averageDeviation) ** 2, 0) /
    Math.max(deviations.length, 1)

  return {
    sampleCount,
    successEstimate: Math.round((successfulRuns / Math.max(sampleCount, 1)) * 100),
    averagePathDeviation: averageDeviation,
    worstDeviation: Math.max(...deviations, 0),
    bestTime: Math.min(...times, 0),
    worstTime: Math.max(...times, 0),
    collisionCountMin: Math.min(...collisions, 0),
    collisionCountMax: Math.max(...collisions, 0),
    consistencySpread: Math.sqrt(deviationVariance),
  }
}
