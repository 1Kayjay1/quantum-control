import { DRONE_COLLIDER_HALF_EXTENTS_CM } from './constants'
import type { DronePose, FieldObject, Vector3 } from './types'

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
    case 'scoringZone':
      return Math.max(object.size.x, object.size.z) * 0.52
    case 'ring':
    case 'gate':
      return Math.max(object.size.x, object.size.y, object.size.z) * 0.45
    case 'marker':
      return 24
    default:
      return Math.max(object.size.x, object.size.z) * 0.5
  }
}

function pointInsideExpandedBox(point: Vector3, object: FieldObject, padding: Vector3): boolean {
  return (
    Math.abs(point.x - object.position.x) <= object.size.x * 0.5 + padding.x &&
    Math.abs(point.y - object.position.y) <= object.size.y * 0.5 + padding.y &&
    Math.abs(point.z - object.position.z) <= object.size.z * 0.5 + padding.z
  )
}

export function pointInsideObject(point: Vector3, object: FieldObject): boolean {
  if (object.type === 'landingZone' || object.type === 'scoringZone') {
    const horizontalDistance = Math.hypot(
      point.x - object.position.x,
      point.z - object.position.z,
    )
    return (
      horizontalDistance <= getObjectContactThreshold(object) &&
      Math.abs(point.y - object.position.y) <= object.size.y + 20
    )
  }

  if (object.type === 'ring') {
    const horizontalDistance = Math.hypot(
      point.x - object.position.x,
      point.z - object.position.z,
    )
    return (
      horizontalDistance <= object.size.x * 0.36 &&
      Math.abs(point.y - object.position.y) <= object.size.y * 0.36
    )
  }

  if (object.type === 'gate') {
    return (
      Math.abs(point.x - object.position.x) <= object.size.x * 0.42 &&
      Math.abs(point.y - object.position.y) <= object.size.y * 0.42 &&
      Math.abs(point.z - object.position.z) <= Math.max(object.size.z * 0.8, 18)
    )
  }

  return pointInsideExpandedBox(point, object, { x: 0, y: 0, z: 0 })
}

export function pointInsideSolidObject(point: Vector3, object: FieldObject): boolean {
  return pointInsideExpandedBox(point, object, DRONE_COLLIDER_HALF_EXTENTS_CM)
}

export function distanceToObject(point: Vector3, object: FieldObject): number {
  if (object.type === 'wall' || object.type === 'boundary' || object.isSolid) {
    const deltaX = Math.max(Math.abs(point.x - object.position.x) - object.size.x * 0.5, 0)
    const deltaY = Math.max(Math.abs(point.y - object.position.y) - object.size.y * 0.5, 0)
    const deltaZ = Math.max(Math.abs(point.z - object.position.z) - object.size.z * 0.5, 0)
    return Math.hypot(deltaX, deltaY, deltaZ)
  }

  return Math.max(0, distanceBetween(point, object.position) - getObjectContactThreshold(object))
}
