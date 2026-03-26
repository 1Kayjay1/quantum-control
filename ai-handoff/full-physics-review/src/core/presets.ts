import {
  DEFAULT_INPUT_STRENGTH,
  DEFAULT_TAKEOFF_HEIGHT_CM,
  ZERO_VECTOR,
} from './constants'
import { createId } from './id'
import type {
  FieldObject,
  FieldObjectType,
  InstructionBlock,
  InstructionKind,
  Vector3,
} from './types'

export interface FieldObjectPreset {
  type: FieldObjectType
  title: string
  description: string
  size: Vector3
  color: string
}

export const FIELD_OBJECT_LIBRARY: FieldObjectPreset[] = [
  {
    type: 'wall',
    title: 'Wall',
    description: 'Rigid blocker used to define lanes, corners, and hard stops.',
    size: { x: 20, y: 120, z: 180 },
    color: '#f76452',
  },
  {
    type: 'gate',
    title: 'Gate',
    description: 'Fly-through frame for alignment practice and checkpoint timing.',
    size: { x: 140, y: 120, z: 24 },
    color: '#5fd5d9',
  },
  {
    type: 'ring',
    title: 'Ring',
    description: 'Circular target to test precision and drift tolerance.',
    size: { x: 100, y: 100, z: 30 },
    color: '#ffd166',
  },
  {
    type: 'landingZone',
    title: 'Landing Zone',
    description: 'Touchdown area used to validate final descent accuracy.',
    size: { x: 110, y: 4, z: 110 },
    color: '#8bd450',
  },
  {
    type: 'scoringZone',
    title: 'Scoring Zone',
    description: 'High-value waypoint to test route timing versus stability.',
    size: { x: 150, y: 4, z: 150 },
    color: '#7f8cff',
  },
  {
    type: 'marker',
    title: 'Marker',
    description: 'Reference point for field mapping, corners, or notes.',
    size: { x: 26, y: 40, z: 26 },
    color: '#c2c8d0',
  },
  {
    type: 'boundary',
    title: 'Boundary',
    description: 'Soft perimeter wall for course edges and no-fly boundaries.',
    size: { x: 10, y: 120, z: 280 },
    color: '#33495e',
  },
]

export const INSTRUCTION_LIBRARY: {
  kind: InstructionKind
  label: string
  description: string
}[] = [
  { kind: 'takeoff', label: 'Takeoff', description: 'Lift to the configured hover height.' },
  { kind: 'land', label: 'Land', description: 'Descend back to the field floor.' },
  { kind: 'hover', label: 'Hover', description: 'Hold position and heading for a fixed time.' },
  {
    kind: 'moveForward',
    label: 'Pitch Forward',
    description: 'Apply forward pitch input for a timed burst.',
  },
  {
    kind: 'moveBackward',
    label: 'Pitch Backward',
    description: 'Apply backward pitch input for a timed burst.',
  },
  { kind: 'strafeLeft', label: 'Roll Left', description: 'Apply left roll input for a timed burst.' },
  { kind: 'strafeRight', label: 'Roll Right', description: 'Apply right roll input for a timed burst.' },
  { kind: 'moveUp', label: 'Throttle Up', description: 'Apply upward throttle input.' },
  { kind: 'moveDown', label: 'Throttle Down', description: 'Apply downward throttle input.' },
  { kind: 'rotateCW', label: 'Yaw Right', description: 'Apply right yaw input for a timed burst.' },
  { kind: 'rotateCCW', label: 'Yaw Left', description: 'Apply left yaw input for a timed burst.' },
  { kind: 'wait', label: 'Wait', description: 'Hold neutral input between route blocks.' },
]

export function createFieldObject(type: FieldObjectType, offset = 0): FieldObject {
  const preset = FIELD_OBJECT_LIBRARY.find((item) => item.type === type)
  if (!preset) {
    throw new Error(`Unknown field object preset: ${type}`)
  }

  return {
    id: createId('object'),
    type,
    name: preset.title,
    position: { x: offset, y: preset.size.y * 0.5, z: offset },
    rotation: { ...ZERO_VECTOR },
    size: { ...preset.size },
    color: preset.color,
    checkpointOrder: null,
    isSolid: type === 'wall' || type === 'boundary',
    windResponsive: type === 'marker',
  }
}

export function createInstructionBlock(kind: InstructionKind): InstructionBlock {
  switch (kind) {
    case 'takeoff':
      return {
        id: createId('instruction'),
        kind,
        label: 'Takeoff',
        strength: DEFAULT_INPUT_STRENGTH,
        distance: DEFAULT_TAKEOFF_HEIGHT_CM,
        angle: 0,
        speed: 55,
        duration: 1.1,
        delayAfter: 0.3,
        stackNextBy: 0,
        note: 'Lift to a stable hover before the first move.',
        versionTag: 'baseline',
        enabled: true,
        timelineLane: 0,
      }
    case 'land':
      return {
        id: createId('instruction'),
        kind,
        label: 'Land',
        strength: DEFAULT_INPUT_STRENGTH,
        distance: 0,
        angle: 0,
        speed: 45,
        duration: 1.2,
        delayAfter: 0,
        stackNextBy: 0,
        note: 'Reduce speed before touchdown.',
        versionTag: 'baseline',
        enabled: true,
        timelineLane: 0,
      }
    case 'hover':
    case 'wait':
      return {
        id: createId('instruction'),
        kind,
        label: kind === 'hover' ? 'Hover' : 'Wait',
        strength: 0,
        distance: 0,
        angle: 0,
        speed: 0,
        duration: 0.8,
        delayAfter: 0.2,
        stackNextBy: 0,
        note: 'Use this block to settle drift or wait for alignment.',
        versionTag: 'baseline',
        enabled: true,
        timelineLane: 0,
      }
    case 'rotateCW':
    case 'rotateCCW':
      return {
        id: createId('instruction'),
        kind,
        label: kind === 'rotateCW' ? 'Yaw Right' : 'Yaw Left',
        strength: DEFAULT_INPUT_STRENGTH,
        distance: 0,
        angle: 90,
        speed: 0,
        duration: 0.9,
        delayAfter: 0.2,
        stackNextBy: 0,
        note: 'Hold yaw input to line up the next segment.',
        versionTag: 'baseline',
        enabled: true,
        timelineLane: 0,
      }
    default:
      return {
        id: createId('instruction'),
        kind,
        label: INSTRUCTION_LIBRARY.find((item) => item.kind === kind)?.label ?? kind,
        strength: DEFAULT_INPUT_STRENGTH,
        distance: 0,
        angle: 0,
        speed: 0,
        duration: 1.3,
        delayAfter: 0.15,
        stackNextBy: 0,
        note: 'Tune the control input strength and hold time against the target marker.',
        versionTag: 'baseline',
        enabled: true,
        timelineLane: 0,
      }
  }
}
