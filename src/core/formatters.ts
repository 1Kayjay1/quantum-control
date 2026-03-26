import type {
  ComparisonSnapshot,
  InstructionBlock,
  InstructionKind,
  RunMetrics,
  SimulationRun,
} from './types'

export function formatCentimeters(value: number): string {
  return `${Math.round(value)} cm`
}

export function formatDegrees(value: number): string {
  return `${Math.round(value)} deg`
}

export function formatSeconds(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} s`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function getInstructionVerb(kind: InstructionKind): string {
  switch (kind) {
    case 'takeoff':
      return 'Takeoff'
    case 'land':
      return 'Land'
    case 'hover':
      return 'Hover'
    case 'moveForward':
      return 'Pitch forward'
    case 'moveBackward':
      return 'Pitch backward'
    case 'strafeLeft':
      return 'Roll left'
    case 'strafeRight':
      return 'Roll right'
    case 'moveUp':
      return 'Throttle up'
    case 'moveDown':
      return 'Throttle down'
    case 'rotateCW':
      return 'Yaw right'
    case 'rotateCCW':
      return 'Yaw left'
    case 'wait':
      return 'Wait'
  }
}

export function formatInstructionLabel(instruction: InstructionBlock): string {
  const verb = getInstructionVerb(instruction.kind)

  switch (instruction.kind) {
    case 'moveForward':
    case 'moveBackward':
    case 'strafeLeft':
    case 'strafeRight':
    case 'moveUp':
    case 'moveDown':
    case 'rotateCW':
    case 'rotateCCW':
      return `${verb} ${Math.round(instruction.strength)} power for ${instruction.duration.toFixed(1)} s`
    case 'hover':
    case 'wait':
      return `${verb} ${instruction.duration.toFixed(1)} s`
    default:
      return verb
  }
}

export function formatMetricsSummary(metrics: RunMetrics): string[] {
  return [
    `Route time ${formatSeconds(metrics.totalTime)}`,
    `Deviation ${formatCentimeters(metrics.pathDeviation)}`,
    `Success estimate ${formatPercent(metrics.completionSuccessEstimate)}`,
  ]
}

export function formatComparisonSummary(comparison: ComparisonSnapshot): string {
  return `${comparison.winner} wins: ${comparison.recommendation}`
}

export function describeRun(run: SimulationRun | null): string {
  if (!run) {
    return 'Run the simulation to view timing, risk, and drift analysis.'
  }

  return [
    `${run.segments.length} steps`,
    `${formatSeconds(run.metrics.totalTime)} total`,
    `${run.metrics.collisionCount} collisions`,
  ].join(' | ')
}
