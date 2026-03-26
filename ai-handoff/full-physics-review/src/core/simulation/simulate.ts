import { Body, Box, ContactMaterial, Material, Plane, Quaternion, Sphere, Vec3, World } from 'cannon-es'

import {
  AIR_DENSITY_KG_M3,
  DRONE_ARM_X_BOX_WORLD,
  DRONE_ARM_Z_BOX_WORLD,
  DRONE_BODY_BOX_WORLD,
  DRONE_TOP_BOX_WORLD,
  DRONE_DRAG_COEFFICIENT,
  DRONE_FRONTAL_AREA_M2,
  DRONE_COLLIDER_HALF_EXTENTS_CM,
  DRONE_MAX_SPEED_MPS,
  DRONE_MOTOR_OFFSETS_WORLD,
  DRONE_MOTOR_RADIUS_WORLD,
  DRONE_PLANFORM_AREA_M2,
  DRONE_ROTOR_RADIUS_M,
  MONTE_CARLO_RUNS,
  PHYSICS_SETTLE_SECONDS,
  PHYSICS_STEP_SECONDS,
} from '../constants'
import { createId } from '../id'
import {
  clamp,
  createSeededRandom,
  degreesToRadians,
  distanceBetween,
  distanceToObject,
  headingVector,
  lerp,
  normalizeHeading,
  pointInsideObject,
  signedNoise,
  strafeVector,
} from '../math'
import { buildFailureMarker, calculatePathDeviation, getTracePointAtTime } from './analysis'
import type {
  BehaviorProfile,
  CheckpointResult,
  FailureMarker,
  FieldLayout,
  FieldObject,
  PlannedSegment,
  RunMetrics,
  SimulationRun,
  SimulationSegmentResult,
  SimulationTracePoint,
  Vector3,
} from '../types'

const CHECKPOINT_TYPES = new Set<FieldObject['type']>([
  'gate',
  'ring',
  'landingZone',
  'scoringZone',
])

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

interface ControlIntent {
  desiredHorizontal: Vector3
  verticalRateCmS: number
  yawRateDegS: number
  autoHover: boolean
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
  body.addShape(
    new Box(
      new Vec3(
        DRONE_BODY_BOX_WORLD.x * 0.5,
        DRONE_BODY_BOX_WORLD.y * 0.5,
        DRONE_BODY_BOX_WORLD.z * 0.5,
      ),
    ),
  )
  body.addShape(
    new Box(
      new Vec3(
        DRONE_TOP_BOX_WORLD.x * 0.5,
        DRONE_TOP_BOX_WORLD.y * 0.5,
        DRONE_TOP_BOX_WORLD.z * 0.5,
      ),
    ),
    new Vec3(0, 0.011, 0),
  )
  body.addShape(
    new Box(
      new Vec3(
        DRONE_ARM_X_BOX_WORLD.x * 0.5,
        DRONE_ARM_X_BOX_WORLD.y * 0.5,
        DRONE_ARM_X_BOX_WORLD.z * 0.5,
      ),
    ),
  )
  body.addShape(
    new Box(
      new Vec3(
        DRONE_ARM_Z_BOX_WORLD.x * 0.5,
        DRONE_ARM_Z_BOX_WORLD.y * 0.5,
        DRONE_ARM_Z_BOX_WORLD.z * 0.5,
      ),
    ),
  )

  for (const [x, y, z] of DRONE_MOTOR_OFFSETS_WORLD) {
    body.addShape(new Sphere(DRONE_MOTOR_RADIUS_WORLD), new Vec3(x, y, z))
  }
}

function createWorld(
  layout: FieldLayout,
  profile: EffectiveBehaviorProfile,
  includeObstacles: boolean,
): SimWorldContext {
  const world = new World()
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
  world.addBody(ground)

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
    world.addBody(body)
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
      world.addBody(body)
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
  world.addBody(droneBody)

  return {
    world,
    body: droneBody,
    collidableObjects,
    obstacleBodyIds,
    draftBodies,
  }
}

function createCheckpointResults(checkpoints: FieldObject[]): CheckpointResult[] {
  return checkpoints.map((checkpoint) => ({
    objectId: checkpoint.id,
    name: checkpoint.name,
    order: checkpoint.checkpointOrder ?? 0,
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
): void {
  const massKg = profile.massKg
  const hoverForce = massKg * 9.81 * clamp(profile.hoverAssistPct, 0.88, 1.12)
  const headingResponse = clamp(profile.turnResponsePct * 10 * profile.attitudeHoldGain, 3.5, 16)
  const headingError = reference
    ? getHeadingDeltaDegrees(reference.heading, state.heading)
    : 0
  const yawAssistDegS = clamp(
    headingError * clamp(headingResponse * 1.8, 7, 22),
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
  const commandedHorizontalMps = {
    x: toMeters(intent.desiredHorizontal.x) * speedScale,
    y: 0,
    z: toMeters(intent.desiredHorizontal.z) * speedScale,
  }
  const currentVelocity = state.body.velocity
  const horizontalSpeed = Math.hypot(currentVelocity.x, currentVelocity.z)
  const localForwardSpeed = currentVelocity.x * forward.x + currentVelocity.z * forward.z
  const localRightSpeed = currentVelocity.x * right.x + currentVelocity.z * right.z

  const desiredHorizontalMps = reference
    ? {
        x: lerp(
          commandedHorizontalMps.x,
          reference.velocityMetersPerSecond.x,
          0.74,
        ),
        y: 0,
        z: lerp(
          commandedHorizontalMps.z,
          reference.velocityMetersPerSecond.z,
          0.74,
        ),
      }
    : { ...commandedHorizontalMps }

  if (reference) {
    const trackingGain = clamp(3.6 + profile.turnResponsePct * 2.4, 3.4, 7.4)
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

  const groundEffectGain = getGroundEffectGain(state.body.position.y)
  const dirtyAirFactor = getDirtyAirFactor(currentVelocity.y, horizontalSpeed) * (intent.autoHover ? 0.18 : 1)
  const dirtyAirSway = dirtyAirFactor * (0.02 + profile.propWashStrength * 0.035)

  const horizontalResponse = intent.activeInstructionIds.length > 0
    ? clamp(8 * profile.accelerationCurve * profile.attitudeHoldGain, 3, 11)
    : intent.autoHover
      ? clamp(9.5 * profile.accelerationCurve * profile.attitudeHoldGain, 5, 12)
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
  const desiredVerticalVelocity = clamp(
    toMeters(intent.verticalRateCmS) * speedScale +
      (state.holdAltitudeMeters - state.body.position.y) * clamp(profile.altitudeHoldGain, 2.4, 9) -
      dirtyAirFactor * 0.22,
    -1.8,
    1.8,
  )
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
  const forceY =
    (hoverForce + massKg * desiredVerticalAcceleration) /
      groundEffectGain +
    verticalDragForce

  state.body.applyForce(
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
      (intent.activeInstructionIds.length > 0 ? 0 : intent.autoHover ? 0.18 : 0.06),
    0.15,
    0.82,
  )

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
  state.heading = normalizeHeading(
    state.heading + nextYawRateDegS * dt,
  )

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

function getCheckpointObjects(layout: FieldLayout): FieldObject[] {
  return layout.objects
    .filter(
      (object) =>
        CHECKPOINT_TYPES.has(object.type) &&
        typeof object.checkpointOrder === 'number' &&
        object.checkpointOrder > 0,
    )
    .sort((left, right) => (left.checkpointOrder ?? 0) - (right.checkpointOrder ?? 0))
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
  objectId: string,
  status: CheckpointResult['status'],
  time: number | null,
) {
  const target = results.find((result) => result.objectId === objectId)
  if (!target) {
    return
  }

  target.status = status
  target.hitTime = time
}

function buildCheckpointMessage(prefix: string, checkpoint: FieldObject): string {
  return `${prefix} Checkpoint ${checkpoint.checkpointOrder} (${checkpoint.name}).`
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
      checkpointResults: [],
      completedCheckpointIds: [],
      skippedCheckpointIds: [],
      invalidCheckpointIds: [],
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
      },
    }
  }

  const random = createSeededRandom(seed)
  const actualProfile = buildEffectiveProfile(behaviorProfile, random)
  const plannedProfile = buildPlannedProfile(behaviorProfile)
  const actualWindows = buildRuntimeWindows(plannedSegments, actualProfile, random, true)
  const plannedWindows = buildRuntimeWindows(plannedSegments, plannedProfile, random, false)
  const collidableObjects = getCollidableObjects(fieldLayout)
  const checkpointObjects = getCheckpointObjects(fieldLayout)
  const checkpointResults = createCheckpointResults(checkpointObjects)
  const failureMarkers: FailureMarker[] = []
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
  }
  const plannedState: DroneSimState = {
    body: plannedWorld.body,
    heading: fieldLayout.spawn.heading,
    holdAltitudeMeters: toMeters(fieldLayout.spawn.position.y),
    pitch: 0,
    roll: 0,
    yawRateDegS: 0,
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
  let actualCollisionSet = new Set<string>()
  const totalTime =
    Math.max(actualWindows.at(-1)?.end ?? 0, plannedWindows.at(-1)?.end ?? 0) +
    PHYSICS_SETTLE_SECONDS

  for (let time = 0; time <= totalTime + 0.0001; time += PHYSICS_STEP_SECONDS) {
    const actualIntent = resolveIntent(actualWindows, time, plannedState.heading)
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
    )
    applyPropWashToObjects(
      actualWorld.draftBodies,
      actualState.body,
      actualProfile,
      PHYSICS_STEP_SECONDS,
      time,
      seed,
    )
    actualWorld.world.step(PHYSICS_STEP_SECONDS)
    plannedWorld.world.step(PHYSICS_STEP_SECONDS)

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

    if (actualIntent.primarySegmentId) {
      getOrCreateArray(actualPointsBySegment, actualIntent.primarySegmentId).push(actualPosition)
    }
    if (plannedIntent.primarySegmentId) {
      getOrCreateArray(plannedPointsBySegment, plannedIntent.primarySegmentId).push(plannedPosition)
    }

    const actualCheckpointContacts = new Set(
      checkpointObjects
        .filter((object) => pointInsideObject(actualPosition, object))
        .map((object) => object.id),
    )
    const plannedCheckpointContacts = new Set(
      checkpointObjects
        .filter((object) => pointInsideObject(plannedPosition, object))
        .map((object) => object.id),
    )

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

      const checkpoint = checkpointObjects.find((object) => object.id === checkpointId)
      if (!checkpoint) {
        continue
      }

      contactedObjectIds.add(checkpointId)
      if (actualIntent.primarySegmentId) {
        getOrCreateSet(actualCheckpointHitsBySegment, actualIntent.primarySegmentId).add(
          checkpointId,
        )
      }

      const checkpointIndex = checkpointObjects.findIndex((object) => object.id === checkpointId)
      if (checkpointIndex > expectedCheckpointIndex) {
        for (let index = expectedCheckpointIndex; index < checkpointIndex; index += 1) {
          const skippedCheckpoint = checkpointObjects[index]
          if (
            completedCheckpointIds.has(skippedCheckpoint.id) ||
            skippedCheckpointIds.has(skippedCheckpoint.id)
          ) {
            continue
          }

          skippedCheckpointIds.add(skippedCheckpoint.id)
          invalidCheckpointIds.add(skippedCheckpoint.id)
          missedObjectIds.add(skippedCheckpoint.id)
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
              buildCheckpointMessage('Skipped required', skippedCheckpoint),
              skippedCheckpoint.position,
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
            buildCheckpointMessage('Entered out of order', checkpoint),
            checkpoint.position,
            time,
          ),
        )
      } else {
        markCheckpointResult(checkpointResults, checkpoint.id, 'hit', time)
      }

      completedCheckpointIds.add(checkpoint.id)
      expectedCheckpointIndex = Math.max(expectedCheckpointIndex, checkpointIndex + 1)
    }

    const currentCollisions = new Set<string>()
    for (const contact of actualWorld.world.contacts) {
      const bodyA = contact.bi.id === actualState.body.id ? contact.bj.id : null
      const bodyB = contact.bj.id === actualState.body.id ? contact.bi.id : null
      const obstacleId =
        (bodyA ? actualWorld.obstacleBodyIds.get(bodyA) : undefined) ??
        (bodyB ? actualWorld.obstacleBodyIds.get(bodyB) : undefined)
      if (obstacleId) {
        currentCollisions.add(obstacleId)
      }
    }

    for (const collisionId of currentCollisions) {
      if (actualCollisionSet.has(collisionId)) {
        continue
      }

      collisionIds.add(collisionId)
      if (actualIntent.primarySegmentId) {
        getOrCreateSet(collisionsBySegment, actualIntent.primarySegmentId).add(collisionId)
      }

      const object = collidableObjects.find((candidate) => candidate.id === collisionId)
      if (object) {
        failureMarkers.push(
          buildFailureMarker(
            actualIntent.primaryInstructionId,
            'collision',
            `Route contact with ${object.name}.`,
            actualPosition,
            time,
          ),
        )
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
    actualCollisionSet = currentCollisions
  }

  for (let index = expectedCheckpointIndex; index < checkpointObjects.length; index += 1) {
    const checkpoint = checkpointObjects[index]
    if (completedCheckpointIds.has(checkpoint.id) || skippedCheckpointIds.has(checkpoint.id)) {
      continue
    }

    skippedCheckpointIds.add(checkpoint.id)
    invalidCheckpointIds.add(checkpoint.id)
    missedObjectIds.add(checkpoint.id)
    markCheckpointResult(checkpointResults, checkpoint.id, 'skipped', null)
    failureMarkers.push(
      buildFailureMarker(
        plannedSegments.at(-1)?.instructionId ?? createId('instruction'),
        'checkpoint',
        buildCheckpointMessage('Route ended before reaching', checkpoint),
        checkpoint.position,
        totalTime,
      ),
    )
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

  const collisionCount = segments.reduce((sum, segment) => sum + segment.collisions.length, 0)
  const checkpointHits = checkpointResults.filter((checkpoint) => checkpoint.status === 'hit').length
  const checkpointTargetCount = checkpointResults.length
  const turnCount = segments.filter(
    (segment) => segment.kind === 'rotateCW' || segment.kind === 'rotateCCW',
  ).length
  const riskPoints = segments.reduce((sum, segment) => sum + segment.riskFlags.length, 0)
  const routeValid =
    collisionCount === 0 &&
    invalidCheckpointIds.size === 0 &&
    checkpointResults.every((checkpoint) => checkpoint.status === 'hit')

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
    checkpointResults,
    completedCheckpointIds: [...completedCheckpointIds],
    skippedCheckpointIds: [...skippedCheckpointIds],
    invalidCheckpointIds: [...invalidCheckpointIds],
    contactedObjectIds: [...contactedObjectIds],
    missedObjectIds: [...missedObjectIds],
    metrics,
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
  return simulateCore(plannedSegments, behaviorProfile, fieldLayout, seed, true)
}
