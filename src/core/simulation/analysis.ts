import { clamp, distanceBetween, lerp, lerpVector } from '../math'
import { createId } from '../id'
import type {
  ComparisonSnapshot,
  FailureMarker,
  SimulationRun,
  SimulationTracePoint,
} from '../types'

export function buildFailureMarker(
  instructionId: string,
  type: FailureMarker['type'],
  message: string,
  position: FailureMarker['position'],
  time: number,
  extras?: Pick<FailureMarker, 'severity' | 'rawContactCount' | 'contactType' | 'normal'>,
): FailureMarker {
  return {
    id: createId('failure'),
    instructionId,
    type,
    message,
    position,
    time,
    ...extras,
  }
}

export function getTracePointAtTime(
  trace: SimulationTracePoint[],
  time: number,
): SimulationTracePoint | null {
  if (trace.length === 0) {
    return null
  }

  if (time <= trace[0].time) {
    return trace[0]
  }

  if (time >= trace[trace.length - 1].time) {
    return trace[trace.length - 1]
  }

  for (let index = 0; index < trace.length - 1; index += 1) {
    const current = trace[index]
    const next = trace[index + 1]
    if (time >= current.time && time <= next.time) {
      const amount = (time - current.time) / Math.max(next.time - current.time, 0.001)
      const nextDynamicObjects = new Map(
        (next.dynamicObjects ?? []).map((object) => [object.objectId, object]),
      )
      const dynamicObjects = (current.dynamicObjects ?? []).map((object) => {
        const nextObject = nextDynamicObjects.get(object.objectId)
        if (!nextObject) {
          return object
        }

        return {
          objectId: object.objectId,
          position: lerpVector(object.position, nextObject.position, amount),
          rotation: {
            x: lerp(object.rotation.x, nextObject.rotation.x, amount),
            y: lerp(object.rotation.y, nextObject.rotation.y, amount),
            z: lerp(object.rotation.z, nextObject.rotation.z, amount),
          },
        }
      })
      return {
        ...current,
        time,
        normalizedTime: lerp(current.normalizedTime, next.normalizedTime, amount),
        plannedPosition: lerpVector(current.plannedPosition, next.plannedPosition, amount),
        actualPosition: lerpVector(current.actualPosition, next.actualPosition, amount),
        plannedHeading: lerp(current.plannedHeading, next.plannedHeading, amount),
        actualHeading: lerp(current.actualHeading, next.actualHeading, amount),
        plannedSpeed: lerp(current.plannedSpeed, next.plannedSpeed, amount),
        actualSpeed: lerp(current.actualSpeed, next.actualSpeed, amount),
        plannedPitch: lerp(current.plannedPitch, next.plannedPitch, amount),
        plannedRoll: lerp(current.plannedRoll, next.plannedRoll, amount),
        actualPitch: lerp(current.actualPitch, next.actualPitch, amount),
        actualRoll: lerp(current.actualRoll, next.actualRoll, amount),
        dynamicObjectPositions: Object.fromEntries(
          dynamicObjects.map((object) => [object.objectId, object.position]),
        ),
        dynamicObjects,
      }
    }
  }

  return trace[trace.length - 1]
}

function routeScore(run: SimulationRun): number {
  const metrics = run.metrics
  return (
    metrics.efficiencyScore * 0.32 +
    metrics.consistencyScore * 0.28 +
    metrics.completionSuccessEstimate * 0.28 -
    metrics.collisionCount * 8 -
    metrics.riskPoints * 0.8 -
    metrics.pathDeviation * 0.08 +
    (metrics.routeValid ? 6 : -10)
  )
}

export function compareRuns(runA: SimulationRun, runB: SimulationRun): ComparisonSnapshot {
  const scoreA = routeScore(runA)
  const scoreB = routeScore(runB)
  const fasterRouteId =
    runA.metrics.totalTime <= runB.metrics.totalTime ? runA.routeVersionId : runB.routeVersionId
  const saferRouteId =
    runA.metrics.riskPoints <= runB.metrics.riskPoints ? runA.routeVersionId : runB.routeVersionId
  const winner = scoreA >= scoreB ? runA.routeVersionId : runB.routeVersionId
  const deltaTime = runA.metrics.totalTime - runB.metrics.totalTime
  const deltaRisk = runA.metrics.riskPoints - runB.metrics.riskPoints
  const deltaDeviation = runA.metrics.pathDeviation - runB.metrics.pathDeviation
  const deltaCollisions = runA.metrics.collisionCount - runB.metrics.collisionCount

  const recommendation = [
    fasterRouteId === winner ? 'wins on pace' : 'gives up time for stability',
    saferRouteId === winner ? 'keeps the cleaner line' : 'shows more risk under drift',
  ].join(', ')

  return {
    routeAId: runA.routeVersionId,
    routeBId: runB.routeVersionId,
    scoreA: clamp(Math.round(scoreA), 0, 100),
    scoreB: clamp(Math.round(scoreB), 0, 100),
    fasterRouteId,
    saferRouteId,
    deltaTime,
    deltaRisk,
    deltaDeviation,
    deltaCollisions,
    winner,
    recommendation,
  }
}

export function calculatePathDeviation(run: SimulationRun): number {
  if (run.trace.length === 0) {
    return 0
  }

  const totalDeviation = run.trace.reduce((sum, point) => {
    return sum + distanceBetween(point.actualPosition, point.plannedPosition)
  }, 0)

  return totalDeviation / run.trace.length
}
