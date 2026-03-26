import {
  DEFAULT_TAKEOFF_HEIGHT_CM,
  DEFAULT_INPUT_STRENGTH,
  MAX_PITCH_ROLL_SPEED_CM_S,
  MAX_THROTTLE_SPEED_CM_S,
  MAX_YAW_SPEED_DEG_S,
} from '../constants'
import { formatInstructionLabel } from '../formatters'
import { createId } from '../id'
import {
  addVector,
  clonePose,
  clamp,
  headingVector,
  normalizeHeading,
  samplePolyline,
  scaleVector,
  strafeVector,
} from '../math'
import type {
  DronePose,
  InstructionBlock,
  PlannedSegment,
  RouteVersion,
} from '../types'

function getStrengthRatio(instruction: InstructionBlock): number {
  return clamp((instruction.strength || DEFAULT_INPUT_STRENGTH) / 100, 0, 1)
}

function getCommandSpeed(instruction: InstructionBlock): number {
  const strengthRatio = getStrengthRatio(instruction)
  const duration = getInstructionDuration(instruction)

  switch (instruction.kind) {
    case 'takeoff':
    case 'land':
      return DEFAULT_TAKEOFF_HEIGHT_CM / Math.max(duration, 0.1)
    case 'moveForward':
    case 'moveBackward':
    case 'strafeLeft':
    case 'strafeRight':
      return MAX_PITCH_ROLL_SPEED_CM_S * strengthRatio
    case 'moveUp':
    case 'moveDown':
      return MAX_THROTTLE_SPEED_CM_S * strengthRatio
    case 'rotateCW':
    case 'rotateCCW':
      return MAX_YAW_SPEED_DEG_S * strengthRatio
    default:
      return 0
  }
}

function buildMovementPose(
  pose: DronePose,
  instruction: InstructionBlock,
  duration: number,
  commandSpeed: number,
): DronePose {
  const nextPose = clonePose(pose)
  let direction = headingVector(nextPose.heading)

  switch (instruction.kind) {
    case 'moveBackward':
      direction = scaleVector(direction, -1)
      break
    case 'strafeLeft':
      direction = strafeVector(nextPose.heading, -1)
      break
    case 'strafeRight':
      direction = strafeVector(nextPose.heading, 1)
      break
    case 'moveUp':
      direction = { x: 0, y: 1, z: 0 }
      break
    case 'moveDown':
      direction = { x: 0, y: -1, z: 0 }
      break
    default:
      break
  }

  nextPose.position = addVector(nextPose.position, scaleVector(direction, commandSpeed * duration))
  return nextPose
}

function getInstructionDuration(instruction: InstructionBlock): number {
  switch (instruction.kind) {
    case 'takeoff':
      return instruction.duration || DEFAULT_TAKEOFF_HEIGHT_CM / 55
    case 'land':
      return instruction.duration || 1.1
    default:
      return Math.max(instruction.duration, 0.1)
  }
}

function applyInstruction(startPose: DronePose, instruction: InstructionBlock): DronePose {
  const nextPose = clonePose(startPose)
  const duration = getInstructionDuration(instruction)
  const commandSpeed = getCommandSpeed(instruction)

  switch (instruction.kind) {
    case 'takeoff':
      nextPose.position.y = DEFAULT_TAKEOFF_HEIGHT_CM
      nextPose.airborne = true
      return nextPose
    case 'land':
      nextPose.position.y = 0
      nextPose.airborne = false
      return nextPose
    case 'hover':
    case 'wait':
      return nextPose
    case 'rotateCW':
      nextPose.heading = normalizeHeading(nextPose.heading + commandSpeed * duration)
      return nextPose
    case 'rotateCCW':
      nextPose.heading = normalizeHeading(nextPose.heading - commandSpeed * duration)
      return nextPose
    default:
      nextPose.airborne = true
      return buildMovementPose(nextPose, instruction, duration, commandSpeed)
  }
}

export function compileInstructionSequence(
  routeVersion: RouteVersion,
  spawn: { position: { x: number; y: number; z: number }; heading: number },
): PlannedSegment[] {
  const startingPose: DronePose = {
    position: { ...spawn.position },
    heading: spawn.heading,
    airborne: false,
  }

  const enabledInstructions = routeVersion.instructions.filter((instruction) => instruction.enabled)
  const segments: PlannedSegment[] = []
  let nextStartTime = 0

  for (const instruction of enabledInstructions) {
    const startPose = segments.at(-1)?.endPose ?? startingPose
    const duration = getInstructionDuration(instruction)
    const commandSpeed = getCommandSpeed(instruction)
    const endPose = applyInstruction(startPose, instruction)
    const plannedDistance =
      instruction.kind === 'rotateCW' || instruction.kind === 'rotateCCW'
        ? 0
        : Math.hypot(
            endPose.position.x - startPose.position.x,
            endPose.position.y - startPose.position.y,
            endPose.position.z - startPose.position.z,
          )
    const plannedAngle =
      instruction.kind === 'rotateCW' || instruction.kind === 'rotateCCW'
        ? commandSpeed * duration
        : 0
    const scheduledStart = nextStartTime
    const scheduledEnd = scheduledStart + duration
    const plannedPoints = samplePolyline(startPose.position, endPose.position, 14)
    const stackNextBy = clamp(instruction.stackNextBy, 0, Math.max(duration - 0.05, 0))

    segments.push({
      id: createId('segment'),
      routeVersionId: routeVersion.id,
      instructionId: instruction.id,
      instructionLabel: formatInstructionLabel(instruction),
      kind: instruction.kind,
      startPose: clonePose(startPose),
      endPose,
      plannedDistance,
      plannedAngle,
      commandSpeed,
      duration,
      delayAfter: instruction.delayAfter,
      stackNextBy,
      scheduledStart,
      scheduledEnd,
      note: instruction.note,
      plannedPoints,
    })

    nextStartTime = Math.max(scheduledStart, scheduledEnd + instruction.delayAfter - stackNextBy)
  }

  return segments
}
