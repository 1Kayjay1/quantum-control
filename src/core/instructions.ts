import type { InstructionKind } from './types'

export type InstructionFamily =
  | 'control'
  | 'timed'
  | 'takeoff'
  | 'land'

export type MovementDirection =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'up'
  | 'down'

export type RotationDirection = 'clockwise' | 'counterclockwise'

export interface DirectionOption<TValue extends string> {
  label: string
  value: TValue
}

export const MOVEMENT_DIRECTION_OPTIONS: DirectionOption<MovementDirection>[] = [
  { label: 'Pitch Forward', value: 'forward' },
  { label: 'Pitch Backward', value: 'backward' },
  { label: 'Roll Left', value: 'left' },
  { label: 'Roll Right', value: 'right' },
  { label: 'Throttle Up', value: 'up' },
  { label: 'Throttle Down', value: 'down' },
]

export const ROTATION_DIRECTION_OPTIONS: DirectionOption<RotationDirection>[] = [
  { label: 'Yaw Right', value: 'clockwise' },
  { label: 'Yaw Left', value: 'counterclockwise' },
]

export function getInstructionFamily(kind: InstructionKind): InstructionFamily {
  switch (kind) {
    case 'takeoff':
      return 'takeoff'
    case 'land':
      return 'land'
    case 'rotateCW':
    case 'rotateCCW':
      return 'control'
    case 'hover':
    case 'wait':
      return 'timed'
    default:
      return 'control'
  }
}

export function getMovementDirection(kind: InstructionKind): MovementDirection {
  switch (kind) {
    case 'moveBackward':
      return 'backward'
    case 'strafeLeft':
      return 'left'
    case 'strafeRight':
      return 'right'
    case 'moveUp':
      return 'up'
    case 'moveDown':
      return 'down'
    default:
      return 'forward'
  }
}

export function getMovementKind(direction: MovementDirection): InstructionKind {
  switch (direction) {
    case 'backward':
      return 'moveBackward'
    case 'left':
      return 'strafeLeft'
    case 'right':
      return 'strafeRight'
    case 'up':
      return 'moveUp'
    case 'down':
      return 'moveDown'
    default:
      return 'moveForward'
  }
}

export function getRotationDirection(kind: InstructionKind): RotationDirection {
  return kind === 'rotateCCW' ? 'counterclockwise' : 'clockwise'
}

export function getRotationKind(direction: RotationDirection): InstructionKind {
  return direction === 'counterclockwise' ? 'rotateCCW' : 'rotateCW'
}

export function invertInstructionKind(kind: InstructionKind): InstructionKind | null {
  switch (kind) {
    case 'moveForward':
      return 'moveBackward'
    case 'moveBackward':
      return 'moveForward'
    case 'strafeLeft':
      return 'strafeRight'
    case 'strafeRight':
      return 'strafeLeft'
    case 'moveUp':
      return 'moveDown'
    case 'moveDown':
      return 'moveUp'
    case 'rotateCW':
      return 'rotateCCW'
    case 'rotateCCW':
      return 'rotateCW'
    default:
      return null
  }
}

export function canInvertInstructionKind(kind: InstructionKind): boolean {
  return invertInstructionKind(kind) !== null
}
