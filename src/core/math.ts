import { DRONE_COLLIDER_HALF_EXTENTS_CM } from './constants'
import { Euler, Quaternion, Vector3 as ThreeVector3 } from 'three'
import type {
  DronePose,
  FieldObject,
  LandingSurface,
  MissionCheckpoint,
  Vector3,
} from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

export function roundToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function normalizeHeading(heading: number): number {
  const normalized = heading % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export function addVector(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }
}

export function scaleVector(vector: Vector3, scale: number): Vector3 {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale,
  }
}

export function distanceBetween(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

export function lerpVector(start: Vector3, end: Vector3, amount: number): Vector3 {
  return {
    x: lerp(start.x, end.x, amount),
    y: lerp(start.y, end.y, amount),
    z: lerp(start.z, end.z, amount),
  }
}

export function headingVector(heading: number): Vector3 {
  const angle = degreesToRadians(heading)
  return {
    x: Math.cos(angle),
    y: 0,
    z: Math.sin(angle),
  }
}

export function strafeVector(heading: number, direction: 1 | -1): Vector3 {
  const angle = degreesToRadians(heading + 90 * direction)
  return {
    x: Math.cos(angle),
    y: 0,
    z: Math.sin(angle),
  }
}

export function clonePose(pose: DronePose): DronePose {
  return {
    position: { ...pose.position },
    heading: pose.heading,
    airborne: pose.airborne,
  }
}

export function samplePolyline(start: Vector3, end: Vector3, samples = 12): Vector3[] {
  return Array.from({ length: samples + 1 }, (_, index) => {
    const amount = index / samples
    return lerpVector(start, end, amount)
  })
}

export function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = Math.imul(value ^ (value >>> 15), 1 | value)
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

export function signedNoise(random: () => number, magnitude: number): number {
  return (random() * 2 - 1) * magnitude
}

export function getObjectContactThreshold(object: FieldObject): number {
  switch (object.type) {
    case 'landingZone':
    case 'landingPad':
    case 'scoringZone':
    case 'colorMat':
      return Math.max(object.size.x, object.size.z) * 0.52
    case 'ring':
    case 'gate':
    case 'keyholeGate':
    case 'tunnel':
      return Math.max(object.size.x, object.size.y, object.size.z) * 0.45
    case 'archGate':
    case 'miniArchGate':
    case 'flyThroughPanel':
      return Math.max(object.size.x, object.size.y) * 0.38
    case 'marker':
      return 24
    default:
  return Math.max(object.size.x, object.size.z) * 0.5
  }
}

function toLocalPoint(point: Vector3, object: FieldObject): Vector3 {
  const quaternion = new Quaternion().setFromEuler(
    new Euler(
      degreesToRadians(object.rotation.x),
      degreesToRadians(object.rotation.y),
      degreesToRadians(object.rotation.z),
      'XYZ',
    ),
  ).invert()
  const vector = new ThreeVector3(
    point.x - object.position.x,
    point.y - object.position.y,
    point.z - object.position.z,
  )
  vector.applyQuaternion(quaternion)
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  }
}

function toWorldPoint(localPoint: Vector3, object: FieldObject): Vector3 {
  const quaternion = new Quaternion().setFromEuler(
    new Euler(
      degreesToRadians(object.rotation.x),
      degreesToRadians(object.rotation.y),
      degreesToRadians(object.rotation.z),
      'XYZ',
    ),
  )
  const vector = new ThreeVector3(localPoint.x, localPoint.y, localPoint.z)
  vector.applyQuaternion(quaternion)
  vector.add(new ThreeVector3(object.position.x, object.position.y, object.position.z))
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  }
}

function pointInsideExpandedBox(point: Vector3, object: FieldObject, padding: Vector3): boolean {
  const localPoint = toLocalPoint(point, object)
  return (
    Math.abs(localPoint.x) <= object.size.x * 0.5 + padding.x &&
    Math.abs(localPoint.y) <= object.size.y * 0.5 + padding.y &&
    Math.abs(localPoint.z) <= object.size.z * 0.5 + padding.z
  )
}

export function pointInsideObject(point: Vector3, object: FieldObject): boolean {
  const localPoint = toLocalPoint(point, object)
  if (
    object.type === 'landingZone' ||
    object.type === 'landingPad' ||
    object.type === 'scoringZone' ||
    object.type === 'colorMat'
  ) {
    const horizontalDistance = Math.hypot(
      localPoint.x,
      localPoint.z,
    )
    return (
      horizontalDistance <= getObjectContactThreshold(object) &&
      Math.abs(localPoint.y) <= object.size.y + 20
    )
  }

  if (object.type === 'ring') {
    const horizontalDistance = Math.hypot(localPoint.x, localPoint.z)
    return (
      horizontalDistance <= object.size.x * 0.36 &&
      Math.abs(localPoint.y) <= object.size.y * 0.36
    )
  }

  if (object.type === 'gate') {
    return (
      Math.abs(localPoint.x) <= object.size.x * 0.42 &&
      Math.abs(localPoint.y) <= object.size.y * 0.42 &&
      Math.abs(localPoint.z) <= Math.max(object.size.z * 0.8, 18)
    )
  }

  if (object.type === 'keyholeGate') {
    const horizontalDistance = Math.hypot(localPoint.x, localPoint.y)
    return (
      horizontalDistance <= (object.metadata?.innerDiameterCm ?? object.size.x * 0.82) * 0.5 &&
      Math.abs(localPoint.z) <= Math.max(object.size.z * 0.8, 18)
    )
  }

  if (object.type === 'archGate' || object.type === 'miniArchGate') {
    return (
      Math.abs(localPoint.x) <= (object.metadata?.innerWidthCm ?? object.size.x * 0.72) * 0.5 &&
      localPoint.y <= (object.metadata?.innerHeightCm ?? object.size.y * 0.72) * 0.5 &&
      localPoint.y >= -object.position.y &&
      Math.abs(localPoint.z) <= Math.max((object.metadata?.outerDepthCm ?? object.size.z) * 0.8, 18)
    )
  }

  if (object.type === 'tunnel') {
    const radial = Math.hypot(localPoint.y, localPoint.z)
    return (
      radial <= (object.metadata?.innerDiameterCm ?? object.size.y) * 0.5 &&
      Math.abs(localPoint.x) <= (object.metadata?.tunnelLengthCm ?? object.size.x) * 0.5
    )
  }

  if (object.type === 'flyThroughPanel') {
    const localX = localPoint.x
    const localY = localPoint.y
    const localZ = Math.abs(localPoint.z)
    const sectionWidth = object.metadata?.sectionWidthCm ?? object.size.x / 3
    const centerSectionX = clamp(localX + object.size.x * 0.5, 0, object.size.x)
    const sectionIndex = Math.floor(centerSectionX / sectionWidth)
    const holeDiameter =
      sectionIndex === 1
        ? object.metadata?.smallHoleDiameterCm ?? 20
        : object.metadata?.largeHoleDiameterCm ?? 25
    const holeCenterX = -object.size.x * 0.5 + sectionWidth * sectionIndex + sectionWidth * 0.5
    const radial = Math.hypot(localX - holeCenterX, localY)
    return radial <= holeDiameter * 0.5 && localZ <= Math.max(object.size.z * 0.8, 10)
  }

  return pointInsideExpandedBox(point, object, { x: 0, y: 0, z: 0 })
}

export function pointInsideSolidObject(point: Vector3, object: FieldObject): boolean {
  return pointInsideExpandedBox(point, object, DRONE_COLLIDER_HALF_EXTENTS_CM)
}

export function distanceToObject(point: Vector3, object: FieldObject): number {
  if (object.type === 'wall' || object.type === 'boundary' || object.isSolid) {
    const localPoint = toLocalPoint(point, object)
    const deltaX = Math.max(Math.abs(localPoint.x) - object.size.x * 0.5, 0)
    const deltaY = Math.max(Math.abs(localPoint.y) - object.size.y * 0.5, 0)
    const deltaZ = Math.max(Math.abs(localPoint.z) - object.size.z * 0.5, 0)
    return Math.hypot(deltaX, deltaY, deltaZ)
  }

  return Math.max(0, distanceBetween(point, object.position) - getObjectContactThreshold(object))
}

export function projectPointToObjectSurface(point: Vector3, object: FieldObject): Vector3 {
  const localPoint = toLocalPoint(point, object)

  if (object.type === 'wall' || object.type === 'boundary' || object.isSolid) {
    const halfX = object.size.x * 0.5
    const halfY = object.size.y * 0.5
    const halfZ = object.size.z * 0.5
    const distances = [
      { axis: 'x' as const, value: halfX - Math.abs(localPoint.x) },
      { axis: 'y' as const, value: halfY - Math.abs(localPoint.y) },
      { axis: 'z' as const, value: halfZ - Math.abs(localPoint.z) },
    ]
    const nearestFace = distances.reduce((nearest, candidate) =>
      candidate.value < nearest.value ? candidate : nearest,
    )
    const surfacePoint = {
      x: clamp(localPoint.x, -halfX, halfX),
      y: clamp(localPoint.y, -halfY, halfY),
      z: clamp(localPoint.z, -halfZ, halfZ),
    }
    surfacePoint[nearestFace.axis] =
      (surfacePoint[nearestFace.axis] >= 0 ? 1 : -1) *
      (nearestFace.axis === 'x' ? halfX : nearestFace.axis === 'y' ? halfY : halfZ)
    return toWorldPoint(surfacePoint, object)
  }

  if (
    object.type === 'landingZone' ||
    object.type === 'landingPad' ||
    object.type === 'scoringZone' ||
    object.type === 'colorMat'
  ) {
    const radius = getObjectContactThreshold(object)
    const radial = Math.hypot(localPoint.x, localPoint.z) || 0.0001
    return toWorldPoint(
      {
        x: (localPoint.x / radial) * Math.min(radial, radius),
        y: clamp(localPoint.y, -object.size.y * 0.5, object.size.y * 0.5),
        z: (localPoint.z / radial) * Math.min(radial, radius),
      },
      object,
    )
  }

  return point
}

export function checkpointSatisfied(
  point: Vector3,
  object: FieldObject,
  checkpoint: MissionCheckpoint,
): boolean {
  switch (checkpoint.passCondition) {
    case 'flyUnder':
    case 'flyThrough':
    case 'flyIntoZone':
    case 'detectColor':
    case 'landOn':
      return pointInsideObject(point, object)
    default:
      return false
  }
}

export function resolveLandingSurface(
  point: Vector3,
  objects: FieldObject[],
): { surface: LandingSurface; objectId: string | null } {
  const landingPad = objects.find((object) => object.type === 'landingPad' && pointInsideObject(point, object))
  if (landingPad) {
    const bullseyeRadius = (landingPad.metadata?.bullseyeDiameterCm ?? 0) * 0.5
    const distance = Math.hypot(point.x - landingPad.position.x, point.z - landingPad.position.z)
    if (bullseyeRadius > 0 && distance <= bullseyeRadius) {
      return { surface: 'bullseye', objectId: landingPad.id }
    }
    return { surface: 'landingPad', objectId: landingPad.id }
  }

  const cubeLarge = objects.find((object) => object.type === 'cubeLarge' && pointInsideObject(point, object))
  if (cubeLarge) {
    return { surface: 'cubeLarge', objectId: cubeLarge.id }
  }

  const cubeSmall = objects.find((object) => object.type === 'cubeSmall' && pointInsideObject(point, object))
  if (cubeSmall) {
    return { surface: 'cubeSmall', objectId: cubeSmall.id }
  }

  return { surface: 'none', objectId: null }
}
