import {
  DRONE_ARM_X_BOX_WORLD,
  DRONE_ARM_Z_BOX_WORLD,
  DRONE_BODY_BOX_WORLD,
  DRONE_DIMENSIONS_WORLD,
  DRONE_MOTOR_OFFSETS_WORLD,
  DRONE_MOTOR_RADIUS_WORLD,
  DRONE_TOP_BOX_WORLD,
} from './constants'
import type { Vector3 } from './types'

export type DroneProxyContactType =
  | 'bodyHit'
  | 'armBrush'
  | 'motorGuardBrush'
  | 'grazingContact'
  | 'hardStop'

export interface DroneProxyComponent {
  id: string
  kind: 'body' | 'arm' | 'motor'
  shape: 'box' | 'sphere'
  offset: Vector3
  size?: Vector3
  radius?: number
}

export interface DroneMeshFitReport {
  importedSize: Vector3
  targetSize: Vector3
  scale: Vector3
  finalSize: Vector3
  delta: Vector3
}

const BASE_COMPONENTS: DroneProxyComponent[] = [
  {
    id: 'body-core',
    kind: 'body',
    shape: 'box',
    offset: { x: 0, y: 0, z: 0 },
    size: { x: DRONE_BODY_BOX_WORLD.x, y: DRONE_BODY_BOX_WORLD.y, z: DRONE_BODY_BOX_WORLD.z },
  },
  {
    id: 'body-top',
    kind: 'body',
    shape: 'box',
    offset: { x: 0, y: 0.011, z: 0 },
    size: { x: DRONE_TOP_BOX_WORLD.x, y: DRONE_TOP_BOX_WORLD.y, z: DRONE_TOP_BOX_WORLD.z },
  },
  {
    id: 'arm-x',
    kind: 'arm',
    shape: 'box',
    offset: { x: 0, y: 0, z: 0 },
    size: { x: DRONE_ARM_X_BOX_WORLD.x, y: DRONE_ARM_X_BOX_WORLD.y, z: DRONE_ARM_X_BOX_WORLD.z },
  },
  {
    id: 'arm-z',
    kind: 'arm',
    shape: 'box',
    offset: { x: 0, y: 0, z: 0 },
    size: { x: DRONE_ARM_Z_BOX_WORLD.x, y: DRONE_ARM_Z_BOX_WORLD.y, z: DRONE_ARM_Z_BOX_WORLD.z },
  },
  ...DRONE_MOTOR_OFFSETS_WORLD.map(([x, y, z], index) => ({
    id: `motor-${index + 1}`,
    kind: 'motor' as const,
    shape: 'sphere' as const,
    offset: { x, y, z },
    radius: DRONE_MOTOR_RADIUS_WORLD,
  })),
]

export const DRONE_PHYSICS_PROXY_COMPONENTS = BASE_COMPONENTS

export const DRONE_SCORING_PROXY_COMPONENTS: DroneProxyComponent[] = BASE_COMPONENTS.map((component) => {
  if (component.shape === 'sphere') {
    return {
      ...component,
      radius: (component.radius ?? DRONE_MOTOR_RADIUS_WORLD) * 1.42,
    }
  }

  if (component.kind === 'body') {
    return {
      ...component,
      size: {
        x: (component.size?.x ?? 0) * 1.06,
        y: (component.size?.y ?? 0) * 1.1,
        z: (component.size?.z ?? 0) * 1.06,
      },
    }
  }

  return {
    ...component,
    size: {
      x: (component.size?.x ?? 0) * 1.08,
      y: (component.size?.y ?? 0) * 1.12,
      z: (component.size?.z ?? 0) * 1.08,
    },
  }
})

export function buildDroneMeshFitReport(importedSize: Vector3): DroneMeshFitReport {
  const scale = {
    x: DRONE_DIMENSIONS_WORLD.width / Math.max(importedSize.x, 0.0001),
    y: DRONE_DIMENSIONS_WORLD.height / Math.max(importedSize.y, 0.0001),
    z: DRONE_DIMENSIONS_WORLD.length / Math.max(importedSize.z, 0.0001),
  }

  return {
    importedSize,
    targetSize: {
      x: DRONE_DIMENSIONS_WORLD.width,
      y: DRONE_DIMENSIONS_WORLD.height,
      z: DRONE_DIMENSIONS_WORLD.length,
    },
    scale,
    finalSize: {
      x: importedSize.x * scale.x,
      y: importedSize.y * scale.y,
      z: importedSize.z * scale.z,
    },
    delta: {
      x: importedSize.x * scale.x - DRONE_DIMENSIONS_WORLD.width,
      y: importedSize.y * scale.y - DRONE_DIMENSIONS_WORLD.height,
      z: importedSize.z * scale.z - DRONE_DIMENSIONS_WORLD.length,
    },
  }
}

export function computeDroneProxyBounds(components: DroneProxyComponent[]) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const component of components) {
    if (component.shape === 'sphere') {
      const radius = component.radius ?? 0
      minX = Math.min(minX, component.offset.x - radius)
      minY = Math.min(minY, component.offset.y - radius)
      minZ = Math.min(minZ, component.offset.z - radius)
      maxX = Math.max(maxX, component.offset.x + radius)
      maxY = Math.max(maxY, component.offset.y + radius)
      maxZ = Math.max(maxZ, component.offset.z + radius)
      continue
    }

    const halfX = (component.size?.x ?? 0) * 0.5
    const halfY = (component.size?.y ?? 0) * 0.5
    const halfZ = (component.size?.z ?? 0) * 0.5
    minX = Math.min(minX, component.offset.x - halfX)
    minY = Math.min(minY, component.offset.y - halfY)
    minZ = Math.min(minZ, component.offset.z - halfZ)
    maxX = Math.max(maxX, component.offset.x + halfX)
    maxY = Math.max(maxY, component.offset.y + halfY)
    maxZ = Math.max(maxZ, component.offset.z + halfZ)
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ,
    },
  }
}

export function toDroneLocalPoint(point: Vector3, dronePositionMeters: Vector3, heading: number): Vector3 {
  const translatedX = point.x - dronePositionMeters.x
  const translatedY = point.y - dronePositionMeters.y
  const translatedZ = point.z - dronePositionMeters.z
  const radians = (-heading * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return {
    x: translatedX * cos - translatedZ * sin,
    y: translatedY,
    z: translatedX * sin + translatedZ * cos,
  }
}

function distanceToBoxSurface(point: Vector3, component: DroneProxyComponent): number {
  const size = component.size ?? { x: 0, y: 0, z: 0 }
  const halfX = size.x * 0.5
  const halfY = size.y * 0.5
  const halfZ = size.z * 0.5
  const localX = point.x - component.offset.x
  const localY = point.y - component.offset.y
  const localZ = point.z - component.offset.z
  const dx = Math.max(Math.abs(localX) - halfX, 0)
  const dy = Math.max(Math.abs(localY) - halfY, 0)
  const dz = Math.max(Math.abs(localZ) - halfZ, 0)
  return Math.hypot(dx, dy, dz)
}

function distanceToSphereSurface(point: Vector3, component: DroneProxyComponent): number {
  const radius = component.radius ?? 0
  const dx = point.x - component.offset.x
  const dy = point.y - component.offset.y
  const dz = point.z - component.offset.z
  return Math.abs(Math.hypot(dx, dy, dz) - radius)
}

export function getDroneProxyContactInfo(localPointMeters: Vector3) {
  let nearest = DRONE_SCORING_PROXY_COMPONENTS[0]
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const component of DRONE_SCORING_PROXY_COMPONENTS) {
    const distance =
      component.shape === 'sphere'
        ? distanceToSphereSurface(localPointMeters, component)
        : distanceToBoxSurface(localPointMeters, component)
    if (distance < nearestDistance) {
      nearest = component
      nearestDistance = distance
    }
  }

  return {
    component: nearest,
    distance: nearestDistance,
  }
}

export function classifyDroneContactType(
  localPointMeters: Vector3,
  severity: 'brush' | 'bump' | 'hard',
  approach: number,
): DroneProxyContactType {
  const nearest = getDroneProxyContactInfo(localPointMeters)
  if (severity === 'hard' && approach >= 0.72) {
    return 'hardStop'
  }
  if (severity === 'brush' && nearest.distance > 0.014) {
    return 'grazingContact'
  }
  if (nearest.component.kind === 'motor') {
    return 'motorGuardBrush'
  }
  if (nearest.component.kind === 'arm') {
    return 'armBrush'
  }
  return 'bodyHit'
}
