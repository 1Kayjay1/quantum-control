import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls, Text } from '@react-three/drei'
import { Box3, Group, Object3D, Plane as ThreePlane, Ray, Vector3 as ThreeVector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useShallow } from 'zustand/react/shallow'

import {
  DRONE_ARM_X_BOX_WORLD,
  DRONE_ARM_Z_BOX_WORLD,
  DRONE_BODY_BOX_WORLD,
  DRONE_DIMENSIONS_WORLD,
  DRONE_MOTOR_OFFSETS_WORLD,
  DRONE_MOTOR_RADIUS_WORLD,
  DRONE_TOP_BOX_WORLD,
  GRID_SIZE_CM,
  WORLD_SCALE,
} from '../core/constants'
import {
  buildDroneMeshFitReport,
  computeDroneProxyBounds,
  DRONE_PHYSICS_PROXY_COMPONENTS,
  DRONE_SCORING_PROXY_COMPONENTS,
  type DroneMeshFitReport,
} from '../core/droneCollision'
import { clamp, degreesToRadians, roundToGrid } from '../core/math'
import { getActiveBehaviorProfile, getActiveLayout, getActiveRoute } from '../core/selectors'
import { getTracePointAtTime } from '../core/simulation/analysis'
import { compileInstructionSequence } from '../core/simulation/compile'
import type {
  FieldLayout,
  FieldObject,
  PlannedSegment,
  SimulationRun,
  Vector3,
} from '../core/types'
import { useProjectStore } from '../store/projectStore'

function SceneCameraRig({
  enabled,
  focusPosition,
}: {
  enabled: boolean
  focusPosition: Vector3 | null
}) {
  const { camera, gl } = useThree()
  const [keys, setKeys] = useState<Record<string, boolean>>({})
  const [pointerLocked, setPointerLocked] = useState(false)
  const yawRef = useRef(0)
  const pitchRef = useRef(0)

  useEffect(() => {
    yawRef.current = camera.rotation.y
    pitchRef.current = camera.rotation.x
  }, [camera])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        void gl.domElement.requestPointerLock()
        return
      }
      setKeys((current) => ({ ...current, [event.key.toLowerCase()]: true }))
      if (event.key === 'Escape') {
        document.exitPointerLock()
      }
      if (event.key.toLowerCase() === 'f' && focusPosition) {
        camera.position.set(
          focusPosition.x * WORLD_SCALE + 1.8,
          Math.max(focusPosition.y * WORLD_SCALE + 1.2, 1.1),
          focusPosition.z * WORLD_SCALE + 1.8,
        )
        camera.lookAt(focusPosition.x * WORLD_SCALE, focusPosition.y * WORLD_SCALE, focusPosition.z * WORLD_SCALE)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      setKeys((current) => ({ ...current, [event.key.toLowerCase()]: false }))
    }

    const handlePointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === gl.domElement)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!pointerLocked) {
        return
      }
      yawRef.current -= event.movementX * 0.0024
      pitchRef.current = clamp(pitchRef.current - event.movementY * 0.002, -1.35, 1.35)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [camera, enabled, focusPosition, gl.domElement, pointerLocked])

  useFrame((_, delta) => {
    if (!enabled) {
      return
    }

    const moveSpeed = (keys.shift ? 3.2 : 1.45) * delta
    const direction = new ThreeVector3()
    const forward = new ThreeVector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    const right = new ThreeVector3().crossVectors(forward, new ThreeVector3(0, 1, 0)).normalize()

    if (keys.w) direction.add(forward)
    if (keys.s) direction.sub(forward)
    if (keys.a) direction.sub(right)
    if (keys.d) direction.add(right)
    if (keys[' ']) direction.y += 1
    if (keys.control) direction.y -= 1
    if (keys.arrowleft) yawRef.current += 0.9 * delta
    if (keys.arrowright) yawRef.current -= 0.9 * delta
    if (keys.arrowup) pitchRef.current = clamp(pitchRef.current + 0.7 * delta, -1.35, 1.35)
    if (keys.arrowdown) pitchRef.current = clamp(pitchRef.current - 0.7 * delta, -1.35, 1.35)

    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(moveSpeed)
      camera.position.add(direction)
    }

    // eslint-disable-next-line react-hooks/immutability
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitchRef.current, yawRef.current, 0)
  })

  return null
}

interface DragState {
  objectId: string
  origin: Vector3
  position: Vector3
}

function toWorld(point: Vector3): [number, number, number] {
  return [point.x * WORLD_SCALE, point.y * WORLD_SCALE, point.z * WORLD_SCALE]
}

function buildPath(points: Vector3[]): [number, number, number][] {
  return points.map(toWorld)
}

function worldToCentimeters(valueInWorldUnits: number): number {
  return valueInWorldUnits / WORLD_SCALE
}

function projectRayToPlane(ray: Ray, heightCm: number): Vector3 | null {
  const plane = new ThreePlane(new ThreeVector3(0, 1, 0), -heightCm * WORLD_SCALE)
  const point = new ThreeVector3()
  if (!ray.intersectPlane(plane, point)) {
    return null
  }

  return {
    x: worldToCentimeters(point.x),
    y: heightCm,
    z: worldToCentimeters(point.z),
  }
}

function clampObjectPosition(
  position: Vector3,
  object: FieldObject,
  layout: FieldLayout,
  snapToGrid: boolean,
): Vector3 {
  const halfWidth = layout.width * 0.5 - object.size.x * 0.5
  const halfLength = layout.length * 0.5 - object.size.z * 0.5
  const minY = object.size.y * 0.5
  const maxY = Math.max(minY, layout.height - object.size.y * 0.5)
  const clampedX = clamp(position.x, -halfWidth, halfWidth)
  const clampedY = clamp(position.y, minY, maxY)
  const clampedZ = clamp(position.z, -halfLength, halfLength)

  return {
    x: snapToGrid ? roundToGrid(clampedX, GRID_SIZE_CM) : clampedX,
    y: clampedY,
    z: snapToGrid ? roundToGrid(clampedZ, GRID_SIZE_CM) : clampedZ,
  }
}

function getTraceTrail(
  run: SimulationRun | null,
  playbackTime: number,
  field: 'plannedPosition' | 'actualPosition',
): Vector3[] {
  if (!run || run.trace.length === 0) {
    return []
  }

  const points = run.trace
    .filter((point) => point.time < playbackTime)
    .map((point) => point[field])
  const activePoint = getTracePointAtTime(run.trace, playbackTime)
  if (activePoint) {
    points.push(activePoint[field])
  }

  return points
}

function getPlannedPoseAtTime(
  segments: PlannedSegment[],
  playbackTime: number,
  spawn: FieldLayout['spawn'],
) {
  if (segments.length === 0) {
    return {
      position: spawn.position,
      heading: spawn.heading,
    }
  }

  const activeSegment =
    segments.find((segment) => playbackTime <= segment.scheduledEnd) ?? segments[segments.length - 1]

  if (playbackTime <= activeSegment.scheduledStart) {
    return {
      position: activeSegment.startPose.position,
      heading: activeSegment.startPose.heading,
    }
  }

  if (playbackTime >= activeSegment.scheduledEnd) {
    return {
      position: activeSegment.endPose.position,
      heading: activeSegment.endPose.heading,
    }
  }

  const progress = clamp(
    (playbackTime - activeSegment.scheduledStart) /
      Math.max(activeSegment.scheduledEnd - activeSegment.scheduledStart, 0.001),
    0,
    1,
  )
  const points = activeSegment.plannedPoints
  const lastIndex = Math.max(points.length - 1, 1)
  const scaledIndex = progress * lastIndex
  const lowerIndex = Math.floor(scaledIndex)
  const upperIndex = Math.min(Math.ceil(scaledIndex), lastIndex)
  const localAmount = scaledIndex - lowerIndex
  const startPoint = points[lowerIndex] ?? activeSegment.startPose.position
  const endPoint = points[upperIndex] ?? activeSegment.endPose.position

  return {
    position: {
      x: startPoint.x + (endPoint.x - startPoint.x) * localAmount,
      y: startPoint.y + (endPoint.y - startPoint.y) * localAmount,
      z: startPoint.z + (endPoint.z - startPoint.z) * localAmount,
    },
    heading:
      activeSegment.startPose.heading +
      (activeSegment.endPose.heading - activeSegment.startPose.heading) * progress,
  }
}

function normalizeDroneScene(scene: Object3D): Object3D {
  const root = new Group()
  const model = scene.clone(true)
  const candidateRotations: Array<[number, number, number]> = [
    [0, 0, 0],
    [0, Math.PI / 2, 0],
    [0, Math.PI, 0],
    [0, -Math.PI / 2, 0],
    [Math.PI / 2, 0, 0],
    [-Math.PI / 2, 0, 0],
    [0, 0, Math.PI / 2],
    [0, 0, -Math.PI / 2],
  ]

  let bestRotation: [number, number, number] = candidateRotations[0]
  let bestScore = Number.POSITIVE_INFINITY

  for (const rotation of candidateRotations) {
    model.rotation.set(rotation[0], rotation[1], rotation[2])
    model.updateMatrixWorld(true)

    const bounds = new Box3().setFromObject(model)
    const size = bounds.getSize(new ThreeVector3())
    const flatnessPenalty = size.y * 12
    const widthPenalty = Math.abs(size.x - DRONE_DIMENSIONS_WORLD.width)
    const lengthPenalty = Math.abs(size.z - DRONE_DIMENSIONS_WORLD.length)
    const score = flatnessPenalty + widthPenalty + lengthPenalty

    if (score < bestScore) {
      bestScore = score
      bestRotation = rotation
    }
  }

  model.rotation.set(bestRotation[0], bestRotation[1], bestRotation[2])
  model.updateMatrixWorld(true)

  const bounds = new Box3().setFromObject(model)
  const size = bounds.getSize(new ThreeVector3())
  const center = bounds.getCenter(new ThreeVector3())

  model.position.sub(center)
  root.add(model)
  root.scale.set(
    DRONE_DIMENSIONS_WORLD.width / Math.max(size.x, 0.0001),
    DRONE_DIMENSIONS_WORLD.height / Math.max(size.y, 0.0001),
    DRONE_DIMENSIONS_WORLD.length / Math.max(size.z, 0.0001),
  )

  root.traverse((child) => {
    if ('castShadow' in child) {
      child.castShadow = true
    }
  })

  return root
}

let cachedDroneAsset: Object3D | null | undefined
let droneAssetPromise: Promise<Object3D | null> | null = null
let cachedDroneFitReport: DroneMeshFitReport | null = null

function loadDroneAsset(): Promise<Object3D | null> {
  if (droneAssetPromise) {
    return droneAssetPromise
  }

  droneAssetPromise = new Promise((resolve) => {
    const loader = new GLTFLoader()
    const candidatePaths = ['/models/codrone-edu.glb', '/models/temp.glb']
    let index = 0

    const tryNextPath = () => {
      const path = candidatePaths[index]
      if (!path) {
        resolve(null)
        return
      }

      loader.load(
        path,
        (gltf) => {
          const importedBounds = new Box3().setFromObject(gltf.scene)
          const importedSize = importedBounds.getSize(new ThreeVector3())
          cachedDroneFitReport = buildDroneMeshFitReport({
            x: importedSize.x,
            y: importedSize.y,
            z: importedSize.z,
          })
          console.info('[Quantum Control] Drone mesh fit report', cachedDroneFitReport)
          resolve(normalizeDroneScene(gltf.scene))
        },
        undefined,
        () => {
          index += 1
          tryNextPath()
        },
      )
    }

    tryNextPath()
  })

  return droneAssetPromise
}

function useDroneAsset() {
  const [asset, setAsset] = useState<Object3D | null>(() =>
    cachedDroneAsset ? cachedDroneAsset.clone(true) : null,
  )
  const [fitReport, setFitReport] = useState<DroneMeshFitReport | null>(cachedDroneFitReport)
  const [mode, setMode] = useState<'loading' | 'gltf' | 'fallback'>(() => {
    if (cachedDroneAsset === undefined) {
      return 'loading'
    }
    return cachedDroneAsset ? 'gltf' : 'fallback'
  })

  useEffect(() => {
    if (cachedDroneAsset !== undefined) {
      return
    }

    let active = true
    void loadDroneAsset().then((loadedAsset) => {
      cachedDroneAsset = loadedAsset
      if (!active) {
        return
      }

      setAsset(loadedAsset ? loadedAsset.clone(true) : null)
      setFitReport(cachedDroneFitReport)
      setMode(loadedAsset ? 'gltf' : 'fallback')
    })

    return () => {
      active = false
    }
  }, [])

  return {
    asset,
    fitReport,
    mode,
  }
}

function ProceduralDrone({
  tint,
  transparent = false,
}: {
  tint: string
  transparent?: boolean
}) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[DRONE_BODY_BOX_WORLD.x, DRONE_BODY_BOX_WORLD.y, DRONE_BODY_BOX_WORLD.z]} />
        <meshStandardMaterial
          color={tint}
          metalness={0.28}
          roughness={0.38}
          transparent={transparent}
          opacity={transparent ? 0.32 : 1}
        />
      </mesh>
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[DRONE_TOP_BOX_WORLD.x, DRONE_TOP_BOX_WORLD.y, DRONE_TOP_BOX_WORLD.z]} />
        <meshStandardMaterial
          color={tint}
          metalness={0.28}
          roughness={0.38}
          transparent={transparent}
          opacity={transparent ? 0.32 : 1}
        />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[DRONE_ARM_X_BOX_WORLD.x, DRONE_ARM_X_BOX_WORLD.y, DRONE_ARM_X_BOX_WORLD.z]} />
        <meshStandardMaterial
          color={tint}
          metalness={0.28}
          roughness={0.38}
          transparent={transparent}
          opacity={transparent ? 0.32 : 1}
        />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[DRONE_ARM_Z_BOX_WORLD.x, DRONE_ARM_Z_BOX_WORLD.y, DRONE_ARM_Z_BOX_WORLD.z]} />
        <meshStandardMaterial
          color={tint}
          metalness={0.28}
          roughness={0.38}
          transparent={transparent}
          opacity={transparent ? 0.32 : 1}
        />
      </mesh>
      {DRONE_MOTOR_OFFSETS_WORLD.map((position, index) => (
        <group key={index} position={position as [number, number, number]}>
          <mesh>
            <cylinderGeometry args={[0.009, 0.009, 0.008, 12]} />
            <meshStandardMaterial
              color={tint}
              metalness={0.28}
              roughness={0.38}
              transparent={transparent}
              opacity={transparent ? 0.32 : 1}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <cylinderGeometry args={[0.019, 0.019, 0.0025, 18]} />
            <meshStandardMaterial
              color={transparent ? '#ced8ff' : '#d4a53a'}
              emissive={transparent ? '#20314e' : '#6d8fe8'}
              transparent
              opacity={transparent ? 0.28 : 0.86}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function DroneColliderGhost() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[DRONE_BODY_BOX_WORLD.x, DRONE_BODY_BOX_WORLD.y, DRONE_BODY_BOX_WORLD.z]} />
        <meshBasicMaterial color="#86efac" wireframe transparent opacity={0.68} />
      </mesh>
      <mesh position={[0, 0.011, 0]}>
        <boxGeometry args={[DRONE_TOP_BOX_WORLD.x, DRONE_TOP_BOX_WORLD.y, DRONE_TOP_BOX_WORLD.z]} />
        <meshBasicMaterial color="#86efac" wireframe transparent opacity={0.68} />
      </mesh>
      <mesh>
        <boxGeometry args={[DRONE_ARM_X_BOX_WORLD.x, DRONE_ARM_X_BOX_WORLD.y, DRONE_ARM_X_BOX_WORLD.z]} />
        <meshBasicMaterial color="#86efac" wireframe transparent opacity={0.68} />
      </mesh>
      <mesh>
        <boxGeometry args={[DRONE_ARM_Z_BOX_WORLD.x, DRONE_ARM_Z_BOX_WORLD.y, DRONE_ARM_Z_BOX_WORLD.z]} />
        <meshBasicMaterial color="#86efac" wireframe transparent opacity={0.68} />
      </mesh>
      {DRONE_MOTOR_OFFSETS_WORLD.map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <sphereGeometry args={[DRONE_MOTOR_RADIUS_WORLD, 10, 10]} />
          <meshBasicMaterial color="#86efac" wireframe transparent opacity={0.68} />
        </mesh>
      ))}
    </group>
  )
}

function DroneScoringGhost() {
  return (
    <group>
      {DRONE_SCORING_PROXY_COMPONENTS.map((component) =>
        component.shape === 'sphere' ? (
          <mesh
            key={component.id}
            position={[component.offset.x, component.offset.y, component.offset.z]}
          >
            <sphereGeometry args={[component.radius ?? 0, 12, 12]} />
            <meshBasicMaterial color="#60a5fa" wireframe transparent opacity={0.5} />
          </mesh>
        ) : (
          <mesh
            key={component.id}
            position={[component.offset.x, component.offset.y, component.offset.z]}
          >
            <boxGeometry args={[component.size?.x ?? 0, component.size?.y ?? 0, component.size?.z ?? 0]} />
            <meshBasicMaterial color="#60a5fa" wireframe transparent opacity={0.5} />
          </mesh>
        ),
      )}
    </group>
  )
}

function DroneVisual({
  position,
  heading,
  pitch = 0,
  roll = 0,
  tint,
  label,
  showCollider = false,
  showScoringCollider = false,
  transparent = false,
}: {
  position: Vector3
  heading: number
  pitch?: number
  roll?: number
  tint: string
  label: string
  showCollider?: boolean
  showScoringCollider?: boolean
  transparent?: boolean
}) {
  const { asset } = useDroneAsset()

  return (
    <group position={toWorld(position)} rotation={[0, -degreesToRadians(heading), 0]}>
      <group rotation={[roll, 0, -pitch]}>
        {asset ? (
          <primitive object={asset} />
        ) : (
          <ProceduralDrone tint={tint} transparent={transparent} />
        )}
        <mesh position={[DRONE_DIMENSIONS_WORLD.width * 0.65, 0, 0]}>
          <coneGeometry args={[0.014, 0.034, 10]} />
          <meshStandardMaterial
            color={transparent ? '#d9e1ff' : tint}
            transparent={transparent}
            opacity={transparent ? 0.5 : 1}
          />
        </mesh>
        {showCollider ? <DroneColliderGhost /> : null}
        {showScoringCollider ? <DroneScoringGhost /> : null}
      </group>
      <Text position={[0, 0.08, 0]} fontSize={0.04} color={transparent ? '#cbd5f5' : tint} anchorX="center">
        {label}
      </Text>
    </group>
  )
}

function FieldObjectMesh({
  object,
  selected,
  onSelect,
  onStartDrag,
  displayPosition,
  displayRotation,
  displaySize,
}: {
  object: FieldObject
  selected: boolean
  onSelect: (objectId: string) => void
  onStartDrag: (objectId: string) => void
  displayPosition?: Vector3
  displayRotation?: Vector3
  displaySize?: Vector3
}) {
  const position = displayPosition ?? object.position
  const rotation = displayRotation ?? object.rotation
  const size = displaySize ?? object.size
  const labelText = object.checkpointOrder ? `CP${object.checkpointOrder} ${object.name}` : object.name
  const baseColor = selected ? '#f6d36a' : object.color
  const labelY = Math.max(size.y * WORLD_SCALE * 0.7, 0.12)
  const interactionArgs: [number, number, number] = [
    Math.max(size.x * WORLD_SCALE, 0.18),
    Math.max(size.y * WORLD_SCALE, 0.18),
    Math.max(size.z * WORLD_SCALE, 0.18),
  ]
  const bindInteraction = {
    onClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation()
      onSelect(object.id)
    },
    onDoubleClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation()
      onSelect(object.id)
      onStartDrag(object.id)
    },
  }

  if (object.type === 'ring' || object.type === 'keyholeGate') {
    return (
      <group
        position={toWorld(position)}
        rotation={[0, degreesToRadians(rotation.y), Math.PI / 2]}
        {...bindInteraction}
      >
        <mesh>
          <torusGeometry
            args={[
              ((object.metadata?.innerDiameterCm ?? size.x * 0.66) * 0.5) * WORLD_SCALE,
              0.018,
              14,
              28,
            ]}
          />
          <meshStandardMaterial color={baseColor} metalness={0.18} roughness={0.42} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[size.x * WORLD_SCALE * 0.35, size.x * WORLD_SCALE * 0.35, 0.03, 24]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.08} />
        </mesh>
        <Text position={[0, 0.32, 0]} fontSize={0.05} color="#edf3ff">
          {labelText}
        </Text>
        <mesh>
          <boxGeometry args={interactionArgs} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  if (object.type === 'gate' || object.type === 'archGate' || object.type === 'miniArchGate') {
    const width = size.x * WORLD_SCALE
    const height = size.y * WORLD_SCALE
    const depth = Math.max(size.z * WORLD_SCALE, 0.05)
    const innerWidth = (object.metadata?.innerWidthCm ?? size.x * 0.82) * WORLD_SCALE
    const innerHeight = (object.metadata?.innerHeightCm ?? size.y * 0.82) * WORLD_SCALE
    return (
      <group
        position={toWorld(position)}
        rotation={[
          degreesToRadians(rotation.x),
          degreesToRadians(rotation.y),
          degreesToRadians(rotation.z),
        ]}
        {...bindInteraction}
      >
        <mesh position={[-width / 2, 0, 0]}>
          <boxGeometry args={[0.05, height, depth]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        <mesh position={[width / 2, 0, 0]}>
          <boxGeometry args={[0.05, height, depth]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width + 0.05, 0.05, depth]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        {object.type === 'miniArchGate' && object.metadata?.tensionStringHeightCm ? (
          <mesh
            position={[
              0,
              -height / 2 + object.metadata.tensionStringHeightCm * WORLD_SCALE,
              0,
            ]}
          >
            <boxGeometry args={[innerWidth, 0.01, depth * 0.8]} />
            <meshStandardMaterial color="#f7f0cf" emissive="#4c3c12" />
          </mesh>
        ) : null}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[innerWidth, innerHeight, depth * 1.15]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.07} />
        </mesh>
        <Text position={[0, height * 0.76, 0]} fontSize={0.05} color="#edf3ff">
          {labelText}
        </Text>
        <mesh>
          <boxGeometry args={interactionArgs} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  if (
    object.type === 'landingZone' ||
    object.type === 'scoringZone' ||
    object.type === 'landingPad' ||
    object.type === 'colorMat'
  ) {
    return (
      <group
        position={toWorld(position)}
        rotation={[
          degreesToRadians(rotation.x),
          degreesToRadians(rotation.y),
          degreesToRadians(rotation.z),
        ]}
        {...bindInteraction}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          {object.type === 'colorMat' ? (
            <boxGeometry args={[size.x * WORLD_SCALE, 0.012, size.z * WORLD_SCALE]} />
          ) : (
            <cylinderGeometry args={[size.x * WORLD_SCALE * 0.48, size.x * WORLD_SCALE * 0.48, 0.025, 28]} />
          )}
          <meshStandardMaterial color={baseColor} transparent opacity={0.34} />
        </mesh>
        {object.type === 'landingPad' && object.metadata?.bullseyeDiameterCm ? (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
            <cylinderGeometry
              args={[
                object.metadata.bullseyeDiameterCm * WORLD_SCALE * 0.5,
                object.metadata.bullseyeDiameterCm * WORLD_SCALE * 0.5,
                0.018,
                22,
              ]}
            />
            <meshStandardMaterial color="#f6f0b5" transparent opacity={0.72} />
          </mesh>
        ) : null}
        <Text position={[0, 0.08, 0]} fontSize={0.05} color="#edf3ff">
          {labelText}
        </Text>
        <mesh>
          <boxGeometry args={interactionArgs} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  if (object.type === 'marker') {
    return (
      <group
        position={toWorld(position)}
        rotation={[
          degreesToRadians(rotation.x),
          degreesToRadians(rotation.y),
          degreesToRadians(rotation.z),
        ]}
        {...bindInteraction}
      >
        <mesh position={[0, 0.12, 0]}>
          <coneGeometry args={[0.05, 0.18, 12]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        <Text position={[0, 0.26, 0]} fontSize={0.05} color="#edf3ff">
          {labelText}
        </Text>
        <mesh>
          <boxGeometry args={interactionArgs} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  if (object.type === 'tunnel') {
    return (
      <group
        position={toWorld(position)}
        rotation={[
          degreesToRadians(rotation.x),
          degreesToRadians(rotation.y),
          degreesToRadians(rotation.z),
        ]}
        {...bindInteraction}
      >
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[size.y * WORLD_SCALE * 0.5, size.y * WORLD_SCALE * 0.5, size.x * WORLD_SCALE, 28, 1, true]}
          />
          <meshStandardMaterial color={baseColor} transparent opacity={0.42} side={2} />
        </mesh>
        <Text position={[0, labelY, 0]} fontSize={0.05} color="#edf3ff">
          {labelText}
        </Text>
        <mesh>
          <boxGeometry args={interactionArgs} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  if (object.type === 'flyThroughPanel') {
    return (
      <group
        position={toWorld(position)}
        rotation={[
          degreesToRadians(rotation.x),
          degreesToRadians(rotation.y),
          degreesToRadians(rotation.z),
        ]}
        {...bindInteraction}
      >
        <mesh>
          <boxGeometry args={[size.x * WORLD_SCALE, size.y * WORLD_SCALE, Math.max(size.z * WORLD_SCALE, 0.04)]} />
          <meshStandardMaterial color={baseColor} transparent opacity={0.2} />
        </mesh>
        <Text position={[0, labelY, 0]} fontSize={0.05} color="#edf3ff">
          {labelText}
        </Text>
        <mesh>
          <boxGeometry args={interactionArgs} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  if (object.type === 'pillar') {
    return (
      <group position={toWorld(position)} {...bindInteraction}>
        <mesh>
          <cylinderGeometry args={[size.x * WORLD_SCALE * 0.5, size.x * WORLD_SCALE * 0.5, size.y * WORLD_SCALE, 18]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        <Text position={[0, labelY, 0]} fontSize={0.05} color="#edf3ff">
          {labelText}
        </Text>
        <mesh>
          <boxGeometry args={interactionArgs} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  return (
    <group
      position={toWorld(position)}
      rotation={[
        degreesToRadians(rotation.x),
        degreesToRadians(rotation.y),
        degreesToRadians(rotation.z),
      ]}
      {...bindInteraction}
    >
      <mesh>
        <boxGeometry
          args={[
            Math.max(size.x * WORLD_SCALE, 0.04),
            Math.max(size.y * WORLD_SCALE, 0.04),
            Math.max(size.z * WORLD_SCALE, 0.04),
          ]}
        />
        <meshStandardMaterial color={baseColor} transparent opacity={0.9} />
      </mesh>
      <Text position={[0, labelY, 0]} fontSize={0.05} color="#edf3ff">
        {labelText}
      </Text>
      <mesh>
        <boxGeometry args={interactionArgs} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
    </group>
  )
}

function SceneView({
  layout,
  selectedObjectId,
  onSelectObject,
  dragState,
  snapToGrid,
  onStartDrag,
  onPreviewDrag,
  plannedDrone,
  plannedHeading,
  plannedPitch,
  plannedRoll,
  actualDrone,
  actualHeading,
  actualPitch,
  actualRoll,
  plannedPath,
  actualPath,
  failureMarkers,
  collisionEvents,
  dynamicObjectPositions,
  dynamicObjectTransforms,
  sceneMode,
  physicsDebugEnabled,
}: {
  layout: FieldLayout
  selectedObjectId: string | null
  onSelectObject: (objectId: string | null) => void
  dragState: DragState | null
  snapToGrid: boolean
  onStartDrag: (objectId: string) => void
  onPreviewDrag: (position: Vector3) => void
  plannedDrone: Vector3
  plannedHeading: number
  plannedPitch: number
  plannedRoll: number
  actualDrone: Vector3
  actualHeading: number
  actualPitch: number
  actualRoll: number
  plannedPath: Vector3[]
  actualPath: Vector3[]
  failureMarkers: SimulationRun['failureMarkers']
  collisionEvents: SimulationRun['collisionEvents']
  dynamicObjectPositions?: Record<string, Vector3>
  dynamicObjectTransforms?: Record<string, { position: Vector3; rotation: Vector3 }>
  sceneMode: boolean
  physicsDebugEnabled: boolean
}) {
  const draggedObject = dragState
    ? layout.objects.find((object) => object.id === dragState.objectId) ?? null
    : null
  const selectedObject = selectedObjectId
    ? layout.objects.find((object) => object.id === selectedObjectId) ?? null
    : null

  const handleDragMove = (event: { stopPropagation: () => void; ray: Ray }) => {
    if (!dragState || !draggedObject) {
      return
    }
    event.stopPropagation()
    const projected = projectRayToPlane(event.ray, dragState.position.y)
    if (!projected) {
      return
    }
    const modifierState = event as {
      shiftKey?: boolean
      ctrlKey?: boolean
      nativeEvent?: { shiftKey?: boolean; ctrlKey?: boolean }
    }
    const shiftKey = modifierState.shiftKey ?? modifierState.nativeEvent?.shiftKey ?? false
    const ctrlKey = modifierState.ctrlKey ?? modifierState.nativeEvent?.ctrlKey ?? false
    const constrained = {
      x: ctrlKey ? dragState.origin.x : projected.x,
      y: projected.y,
      z: shiftKey ? dragState.origin.z : projected.z,
    }
    onPreviewDrag(clampObjectPosition(constrained, draggedObject, layout, snapToGrid))
  }

  return (
    <>
      <ambientLight intensity={0.72} />
      <directionalLight position={[4.5, 6.5, 3]} intensity={1.25} color="#ffe2a8" />
      <directionalLight position={[-5.5, 3.5, -4]} intensity={0.35} color="#5b7cf0" />
      <hemisphereLight intensity={0.36} color="#aee0ff" groundColor="#11311f" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
        <planeGeometry args={[layout.width * WORLD_SCALE, layout.length * WORLD_SCALE]} />
        <meshStandardMaterial color="#17311c" />
      </mesh>

      <gridHelper
        args={[
          Math.max(layout.width, layout.length) * WORLD_SCALE,
          Math.max(Math.round(Math.max(layout.width, layout.length) / 25), 12),
          '#3f6bff',
          '#244026',
        ]}
        position={[0, 0.002, 0]}
      />

      {layout.objects.map((object) => (
        <FieldObjectMesh
          key={object.id}
          object={object}
          selected={object.id === selectedObjectId}
          onSelect={onSelectObject}
          onStartDrag={onStartDrag}
          displayPosition={
            dragState?.objectId === object.id
              ? dragState.position
              : dynamicObjectTransforms?.[object.id]?.position ?? dynamicObjectPositions?.[object.id]
          }
          displayRotation={
            dynamicObjectTransforms?.[object.id]?.rotation
          }
        />
      ))}

      {dragState && draggedObject ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, dragState.position.y * WORLD_SCALE, 0]}
          onPointerMove={handleDragMove}
          onPointerUp={(event) => {
            event.stopPropagation()
          }}
        >
          <planeGeometry args={[layout.width * WORLD_SCALE * 2.4, layout.length * WORLD_SCALE * 2.4]} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      ) : null}

      {plannedPath.length > 1 ? (
        <Line points={buildPath(plannedPath)} color="#f6d36a" lineWidth={1.1} transparent opacity={0.44} />
      ) : null}

      {actualPath.length > 1 ? (
        <Line points={buildPath(actualPath)} color="#74b6ff" lineWidth={2.1} />
      ) : null}

      {failureMarkers.map((marker) => (
        <mesh key={marker.id} position={toWorld(marker.position)}>
          <sphereGeometry args={[0.038, 14, 14]} />
          <meshStandardMaterial
            color={
              marker.type === 'collision'
                ? marker.severity === 'hard'
                  ? '#ff4d5f'
                  : marker.severity === 'bump'
                    ? '#ff9a62'
                    : '#ffd36e'
                : marker.type === 'checkpoint'
                  ? '#a78bfa'
                  : marker.type === 'miss'
                    ? '#ffcf63'
                    : '#fb7185'
            }
            emissive="#1a1024"
          />
        </mesh>
      ))}

      {physicsDebugEnabled
        ? collisionEvents.map((event) => (
            <group key={`contact-${event.id}`}>
              <mesh position={toWorld(event.representativeContactPoint)}>
                <sphereGeometry args={[0.026, 12, 12]} />
                <meshBasicMaterial
                  color={
                    event.severity === 'hard'
                      ? '#fb7185'
                      : event.severity === 'bump'
                        ? '#f59e0b'
                        : '#fde68a'
                  }
                />
              </mesh>
              <Line
                points={[
                  toWorld(event.representativeContactPoint),
                  toWorld({
                    x: event.representativeContactPoint.x + event.representativeNormal.x * 12,
                    y: event.representativeContactPoint.y + event.representativeNormal.y * 12,
                    z: event.representativeContactPoint.z + event.representativeNormal.z * 12,
                  }),
                ]}
                color="#f8fafc"
                lineWidth={1.2}
              />
            </group>
          ))
        : null}

      <DroneVisual
        position={plannedDrone}
        heading={plannedHeading}
        pitch={plannedPitch}
        roll={plannedRoll}
        tint="#f6d36a"
        label="Planned"
        transparent
      />
      <DroneVisual
        position={actualDrone}
        heading={actualHeading}
        pitch={actualPitch}
        roll={actualRoll}
        tint="#74b6ff"
        label="Actual"
        showCollider
        showScoringCollider={physicsDebugEnabled}
      />

      <OrbitControls
        makeDefault
        enabled={!sceneMode && !dragState}
        enableDamping
        dampingFactor={0.08}
        enablePan
        screenSpacePanning
        target={[0, 0.55, 0]}
        minDistance={2.4}
        maxDistance={9}
        maxPolarAngle={Math.PI / 2.02}
      />
      <SceneCameraRig enabled={sceneMode && !dragState} focusPosition={selectedObject?.position ?? null} />
    </>
  )
}

export function FieldViewport() {
  const {
    project,
    activeLayoutId,
    activeRouteId,
    run,
    playbackTime,
    setPlaybackState,
    selectedObjectId,
    selectObject,
    updateFieldObject,
    snapToGrid,
    setPlaybackTime,
    playbackState,
    workspaceMode,
    physicsDebugEnabled,
    activeBehaviorProfileId,
  } = useProjectStore(
    useShallow((state) => ({
      project: state.project,
      activeLayoutId: state.activeLayoutId,
      activeRouteId: state.activeRouteId,
      run: state.run,
      playbackTime: state.playbackTime,
      setPlaybackState: state.setPlaybackState,
      selectedObjectId: state.selectedObjectId,
      selectObject: state.selectObject,
      updateFieldObject: state.updateFieldObject,
      snapToGrid: state.snapToGrid,
      setPlaybackTime: state.setPlaybackTime,
      playbackState: state.playbackState,
      workspaceMode: state.workspaceMode,
      physicsDebugEnabled: state.physicsDebugEnabled,
      activeBehaviorProfileId: state.activeBehaviorProfileId,
    })),
  )
  const [dragState, setDragState] = useState<DragState | null>(null)

  const layout = getActiveLayout(project, activeLayoutId)
  const route = getActiveRoute(project, activeRouteId)
  const behaviorProfile = getActiveBehaviorProfile(project, activeBehaviorProfileId)
  const compiledSegments = compileInstructionSequence(route, layout.spawn)
  const activeTrace = run ? getTracePointAtTime(run.trace, playbackTime) : null
  const activeSegments = run?.segments.filter(
    (segment) => playbackTime >= segment.startTime && playbackTime <= segment.endTime + segment.delayAfter,
  ) ?? []
  const activeSegmentLabels = activeSegments.map((segment) => segment.instructionLabel).join(', ')
  const plannedPose = getPlannedPoseAtTime(compiledSegments, playbackTime, layout.spawn)
  const plannedDrone = plannedPose.position
  const plannedHeading = plannedPose.heading
  const plannedPitch = 0
  const plannedRoll = 0
  const actualDrone = activeTrace?.actualPosition ?? layout.spawn.position
  const actualHeading = activeTrace?.actualHeading ?? layout.spawn.heading
  const actualPitch = activeTrace?.actualPitch ?? 0
  const actualRoll = activeTrace?.actualRoll ?? 0
  const plannedPath = compiledSegments.flatMap((segment) => segment.plannedPoints)
  const actualPath = getTraceTrail(run, playbackTime, 'actualPosition')
  const dronePhysicsProxyBounds = computeDroneProxyBounds(DRONE_PHYSICS_PROXY_COMPONENTS)
  const droneScoringProxyBounds = computeDroneProxyBounds(DRONE_SCORING_PROXY_COMPONENTS)
  const dynamicObjectPositions = activeTrace?.dynamicObjectPositions
  const dynamicObjectTransforms = activeTrace?.dynamicObjects
    ? Object.fromEntries(
        activeTrace.dynamicObjects.map((object) => [
          object.objectId,
          {
            position: object.position,
            rotation: object.rotation,
          },
        ]),
      )
    : undefined
  const selectedObject = selectedObjectId
    ? layout.objects.find((object) => object.id === selectedObjectId) ?? null
    : null
  const drift =
    activeTrace
      ? clamp(
          Math.hypot(
            activeTrace.actualPosition.x - activeTrace.plannedPosition.x,
            activeTrace.actualPosition.y - activeTrace.plannedPosition.y,
            activeTrace.actualPosition.z - activeTrace.plannedPosition.z,
          ),
          0,
          9999,
        )
      : 0
  const checkpointHits = run?.checkpointResults.filter((checkpoint) => checkpoint.status === 'hit').length ?? 0
  const checkpointCount = run?.checkpointResults.length ?? 0
  const velocityVector = activeTrace
    ? {
        x: activeTrace.actualPosition.x - activeTrace.plannedPosition.x,
        y: activeTrace.actualPitch * 100,
        z: activeTrace.actualRoll * 100,
      }
    : { x: 0, y: 0, z: 0 }
  const currentInstruction = activeSegments[0]?.instructionLabel ?? 'Idle'
  const carryWindows = compiledSegments
    .filter((segment) =>
      ['moveForward', 'moveBackward', 'strafeLeft', 'strafeRight'].includes(segment.kind),
    )
    .map((segment) => ({
      id: segment.id,
      start: segment.scheduledEnd,
      duration: behaviorProfile.coastDurationMs / 1000,
      label: 'carry',
    }))
  const currentFrame = Math.round(playbackTime / (1 / 60))
  const totalFrames = Math.round((run?.metrics.totalTime ?? 0) / (1 / 60))
  const toolbarButtonClass =
    'inline-flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] hover:text-white'
  const handleStartDrag = (objectId: string) => {
    const object = layout.objects.find((candidate) => candidate.id === objectId)
    if (!object) {
      return
    }

    setDragState({
      objectId,
      origin: { ...object.position },
      position: { ...object.position },
    })
    selectObject(objectId)
    setPlaybackState('paused')
  }

  const handlePreviewDrag = (position: Vector3) => {
    setDragState((current) => (current ? { ...current, position } : current))
  }

  useEffect(() => {
    if (!dragState) {
      return
    }

    const commitDrag = () => {
      setDragState((current) => {
        if (!current) {
          return current
        }

        updateFieldObject(current.objectId, {
          position: current.position,
        })
        return null
      })
    }

    window.addEventListener('pointerup', commitDrag)

    return () => {
      window.removeEventListener('pointerup', commitDrag)
    }
  }, [dragState, updateFieldObject])

  useEffect(() => {
    if (!selectedObject || dragState || workspaceMode === 'scene') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      const step = event.shiftKey ? 1 : event.ctrlKey ? 10 : 4
      let nextPosition: Vector3 | null = null

      if (event.key === 'ArrowUp') {
        nextPosition = { ...selectedObject.position, y: selectedObject.position.y + step }
      } else if (event.key === 'ArrowDown') {
        nextPosition = { ...selectedObject.position, y: selectedObject.position.y - step }
      } else if (event.key === 'ArrowLeft') {
        nextPosition = { ...selectedObject.position, x: selectedObject.position.x - step }
      } else if (event.key === 'ArrowRight') {
        nextPosition = { ...selectedObject.position, x: selectedObject.position.x + step }
      }

      if (!nextPosition) {
        return
      }

      event.preventDefault()
      updateFieldObject(selectedObject.id, {
        position: clampObjectPosition(nextPosition, selectedObject, layout, snapToGrid),
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dragState, layout, selectedObject, snapToGrid, updateFieldObject, workspaceMode])

  return (
    <section className={`relative min-h-0 w-full overflow-hidden ${workspaceMode === 'scene' ? 'h-full rounded-none' : 'h-[clamp(560px,66vh,740px)] rounded-[22px] max-[900px]:h-[clamp(440px,56vh,540px)]'} bg-[radial-gradient(circle_at_22%_10%,rgba(116,182,255,0.12),transparent_22%),linear-gradient(180deg,rgba(32,67,126,0.96)_0%,rgba(14,31,70,0.98)_42%,rgba(20,44,25,0.98)_42.5%,rgba(10,19,15,1)_100%)]`}>
      <div className="pointer-events-none absolute left-5 top-5 z-20 flex flex-wrap gap-3 rounded-2xl bg-[#04101bcc]/80 px-4 py-3 text-xs text-slate-200 backdrop-blur-md">
        <span>T {playbackTime.toFixed(2)}s</span>
        <span>SPD {activeTrace?.actualSpeed.toFixed(1) ?? '0.0'} cm/s</span>
        <span>HDG {activeTrace?.actualHeading.toFixed(0) ?? layout.spawn.heading} deg</span>
        <span>ALT {activeTrace?.actualPosition.y.toFixed(1) ?? layout.spawn.position.y.toFixed(1)} cm</span>
        <span>DRIFT {drift.toFixed(1)} cm</span>
        <span>CP {checkpointHits}/{checkpointCount}</span>
      </div>
      {workspaceMode === 'scene' ? (
        <div className="pointer-events-none absolute right-5 top-5 z-20 grid gap-2 rounded-2xl bg-[#04101bcc]/80 px-4 py-3 text-xs text-slate-200 backdrop-blur-md">
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Telemetry</span>
          <span>Instruction: {currentInstruction}</span>
          <span>Active Segments: {activeSegmentLabels || 'None'}</span>
          <span>Collisions: {run?.metrics.collisionCount ?? 0}</span>
          <span>Checkpoint: {checkpointHits}/{checkpointCount}</span>
          {physicsDebugEnabled ? (
            <>
              <span>Vel Vec: {velocityVector.x.toFixed(1)} / {velocityVector.z.toFixed(1)}</span>
              <span>Pitch/Roll: {activeTrace?.actualPitch.toFixed(2) ?? '0.00'} / {activeTrace?.actualRoll.toFixed(2) ?? '0.00'}</span>
              <span>Ground Effect: {actualDrone.y < 25 ? 'Elevated' : 'Normal'}</span>
              <span>Proxy W/L/H: {(dronePhysicsProxyBounds.size.x * 100).toFixed(1)} / {(dronePhysicsProxyBounds.size.z * 100).toFixed(1)} / {(dronePhysicsProxyBounds.size.y * 100).toFixed(1)} cm</span>
              <span>Score W/L/H: {(droneScoringProxyBounds.size.x * 100).toFixed(1)} / {(droneScoringProxyBounds.size.z * 100).toFixed(1)} / {(droneScoringProxyBounds.size.y * 100).toFixed(1)} cm</span>
            </>
          ) : null}
        </div>
      ) : null}
      <Canvas
        className="!h-full !w-full"
        style={{ height: '100%', width: '100%' }}
        camera={{ position: [4.6, 3.3, 4.9], fov: 44 }}
        shadows
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => {
          if (!dragState) {
            selectObject(null)
          }
        }}
      >
        <SceneView
          layout={layout}
          selectedObjectId={selectedObjectId}
          onSelectObject={selectObject}
          dragState={dragState}
          snapToGrid={snapToGrid}
          onStartDrag={handleStartDrag}
          onPreviewDrag={handlePreviewDrag}
          plannedDrone={plannedDrone}
          plannedHeading={plannedHeading}
          plannedPitch={plannedPitch}
          plannedRoll={plannedRoll}
          actualDrone={actualDrone}
          actualHeading={actualHeading}
          actualPitch={actualPitch}
          actualRoll={actualRoll}
          plannedPath={plannedPath}
          actualPath={actualPath}
          failureMarkers={run?.failureMarkers ?? []}
          collisionEvents={run?.collisionEvents ?? []}
          dynamicObjectPositions={dynamicObjectPositions}
          dynamicObjectTransforms={dynamicObjectTransforms}
          sceneMode={workspaceMode === 'scene'}
          physicsDebugEnabled={physicsDebugEnabled}
        />
      </Canvas>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 bg-gradient-to-t from-[#07101b] via-[#07101be8] to-transparent px-5 py-4 backdrop-blur-sm max-[900px]:justify-start">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Replay</span>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              setPlaybackState('paused')
              setPlaybackTime(Math.max(0, playbackTime - 5))
            }}
          >
            Back 5s
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing')}
          >
            {playbackState === 'playing' ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              setPlaybackState('paused')
              setPlaybackTime(Math.max(0, playbackTime - 1 / 60))
            }}
          >
            Prev Frame
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              setPlaybackState('paused')
              setPlaybackTime(playbackTime + 1 / 60)
            }}
          >
            Next Frame
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => {
              setPlaybackState('paused')
              setPlaybackTime(playbackTime + 5)
            }}
          >
            Forward 5s
          </button>
          <span className="text-sm text-slate-400">
            Frame {run ? `${currentFrame}/${totalFrames}` : '0/0'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Object Edit</span>
          <span className="text-sm text-slate-400">
            {selectedObject
              ? `${selectedObject.name} selected · drag to move · Shift = X only · Ctrl = Z only · ↑↓ height`
              : 'No object selected'}
          </span>
        </div>
      </div>

      {carryWindows.length > 0 ? (
        <div className="pointer-events-none absolute bottom-20 left-5 right-5 z-20 flex gap-2 overflow-hidden">
          {carryWindows.slice(0, 6).map((window) => (
            <div
              key={window.id}
              className="h-2 rounded-full bg-gradient-to-r from-cyan-300/55 to-transparent"
              style={{
                width: `${Math.max(window.duration * 80, 24)}px`,
                opacity:
                  playbackTime >= window.start && playbackTime <= window.start + window.duration
                    ? 1
                    : 0.28,
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
