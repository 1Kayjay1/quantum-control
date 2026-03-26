import { describe, expect, it } from 'vitest'

import { createStarterProject } from '../sampleProject'
import { compileInstructionSequence } from './compile'
import { simulateRoute } from './simulate'

describe('simulateRoute', () => {
  it('is deterministic for the same seed', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const layout = project.fieldLayouts[0]
    const profile = project.behaviorProfiles[0]
    const segments = compileInstructionSequence(route, layout.spawn)

    const runA = simulateRoute(segments, profile, layout, 4)
    const runB = simulateRoute(segments, profile, layout, 4)

    expect(runA.metrics.totalTime).toBe(runB.metrics.totalTime)
    expect(runA.metrics.pathDeviation).toBe(runB.metrics.pathDeviation)
    expect(runA.missedObjectIds).toEqual(runB.missedObjectIds)
  })

  it('tracks collisions and success estimates', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const layout = project.fieldLayouts[0]
    const profile = project.behaviorProfiles[0]
    const segments = compileInstructionSequence(route, layout.spawn)

    const run = simulateRoute(segments, profile, layout, 7)

    expect(run.metrics.instructionCount).toBeGreaterThan(0)
    expect(run.metrics.completionSuccessEstimate).toBeGreaterThanOrEqual(0)
    expect(run.metrics.completionSuccessEstimate).toBeLessThanOrEqual(100)
  })

  it('tracks ordered checkpoints on the route', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const layout = project.fieldLayouts[0]
    const profile = project.behaviorProfiles[1]
    const segments = compileInstructionSequence(route, layout.spawn)

    const run = simulateRoute(segments, profile, layout, 2)

    expect(run.metrics.checkpointTargetCount).toBeGreaterThan(0)
    expect(run.checkpointResults[0]?.order).toBe(1)
    expect(run.checkpointResults.every((checkpoint) => checkpoint.order > 0)).toBe(true)
  })

  it('marks the route invalid if landing happens before required checkpoints are complete', () => {
    const project = createStarterProject()
    const layout = project.fieldLayouts[0]
    const profile = project.behaviorProfiles[1]
    const route = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[0] },
        { ...project.routeVersions[0].instructions.at(-1)! },
      ],
    }

    const segments = compileInstructionSequence(route, layout.spawn)
    const run = simulateRoute(segments, profile, layout, 15)

    expect(run.metrics.routeValid).toBe(false)
    expect(run.routeInvalidReason).toContain('Missed required checkpoints')
    expect(run.landingResult.valid).toBe(false)
  })

  it('includes deterministic color-detection checkpoints in the mission state', () => {
    const project = createStarterProject()
    const layout = project.fieldLayouts[0]
    const colorCheckpoint = layout.missionCheckpoints.find((checkpoint) => checkpoint.passCondition === 'detectColor')

    expect(colorCheckpoint).toBeDefined()
    expect(layout.objects.find((object) => object.id === colorCheckpoint?.objectId)?.type).toBe('colorMat')
  })

  it('records tilt data in the replay trace', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const layout = project.fieldLayouts[0]
    const profile = project.behaviorProfiles[0]
    const segments = compileInstructionSequence(route, layout.spawn)

    const run = simulateRoute(segments, profile, layout, 5)

    expect(run.trace.length).toBeGreaterThan(0)
    expect(run.trace.some((point) => Math.abs(point.actualPitch) > 0 || Math.abs(point.actualRoll) > 0)).toBe(true)
  })

  it('keeps the actual replay anchored to the planned route under calm conditions', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const layout = project.fieldLayouts[0]
    const profile = project.behaviorProfiles[1]
    const segments = compileInstructionSequence(route, layout.spawn)

    const run = simulateRoute(segments, profile, layout, 11)
    const maxHeadingDelta = run.trace.reduce((maxDelta, point, index, trace) => {
      if (index === 0) {
        return maxDelta
      }

      const previous = trace[index - 1]
      const delta = Math.abs(point.actualHeading - previous.actualHeading)
      const wrappedDelta = Math.min(delta, 360 - delta)
      return Math.max(maxDelta, wrappedDelta)
    }, 0)

    expect(run.metrics.pathDeviation).toBeLessThan(240)
    expect(maxHeadingDelta).toBeLessThan(45)
  })

  it('does not spin uncontrollably on a pure throttle-up command', () => {
    const project = createStarterProject()
    const layout = project.fieldLayouts[0]
    const profile = project.behaviorProfiles[1]
    const route = {
      ...project.routeVersions[0],
      instructions: [
        {
          ...project.routeVersions[0].instructions[5],
          kind: 'moveUp' as const,
          label: 'Throttle Up',
          strength: 58,
          duration: 0.6,
          delayAfter: 0.15,
          stackNextBy: 0,
          enabled: true,
        },
      ],
    }

    const segments = compileInstructionSequence(route, layout.spawn)
    const run = simulateRoute(segments, profile, layout, 9)
    const headingRange = run.trace.reduce(
      (range, point) => {
        return {
          min: Math.min(range.min, point.actualHeading),
          max: Math.max(range.max, point.actualHeading),
        }
      },
      { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    )

    expect(headingRange.max - headingRange.min).toBeLessThan(20)
    expect(run.trace.at(-1)?.actualPosition.y ?? 0).toBeGreaterThan(10)
  })

  it('implicitly hovers after a climb input until the next command', () => {
    const project = createStarterProject()
    const layout = project.fieldLayouts[0]
    const profile = project.behaviorProfiles[1]
    const route = {
      ...project.routeVersions[0],
      instructions: [
        {
          ...project.routeVersions[0].instructions[5],
          kind: 'moveUp' as const,
          label: 'Throttle Up',
          strength: 30,
          duration: 1.2,
          delayAfter: 0.6,
          stackNextBy: 0,
          enabled: true,
        },
        {
          ...project.routeVersions[0].instructions[1],
          kind: 'moveForward' as const,
          label: 'Pitch Forward',
          strength: 30,
          duration: 0.2,
          delayAfter: 0,
          stackNextBy: 0,
          enabled: true,
        },
      ],
    }

    const segments = compileInstructionSequence(route, layout.spawn)
    const run = simulateRoute(segments, profile, layout, 12)
    const betweenCommands = run.trace.filter(
      (point) => point.time > segments[0].scheduledEnd && point.time < segments[1].scheduledStart,
    )

    expect(betweenCommands.length).toBeGreaterThan(0)
    const altitudeRange =
      Math.max(...betweenCommands.map((point) => point.actualPosition.y)) -
      Math.min(...betweenCommands.map((point) => point.actualPosition.y))
    const maxHoverSpeed = Math.max(...betweenCommands.map((point) => point.actualSpeed))

    expect(altitudeRange).toBeLessThan(18)
    expect(maxHoverSpeed).toBeLessThan(55)
  })

  it('keeps a bounded horizontal carry after input release', () => {
    const project = createStarterProject()
    const layout = project.fieldLayouts[0]
    const profile = {
      ...project.behaviorProfiles[1],
      randomizeConditions: false,
      carryPct: 0.42,
      coastDurationMs: 520,
      hoverBrakeAssistPct: 0.44,
      referenceAssistDuringCoastPct: 0.14,
    }
    const route = {
      ...project.routeVersions[0],
      instructions: [
        {
          ...project.routeVersions[0].instructions[5],
          kind: 'moveUp' as const,
          label: 'Throttle Up',
          strength: 34,
          duration: 1.0,
          delayAfter: 0.2,
          stackNextBy: 0,
          enabled: true,
        },
        {
          ...project.routeVersions[0].instructions[1],
          kind: 'moveForward' as const,
          label: 'Pitch Forward',
          strength: 42,
          duration: 0.55,
          delayAfter: 0,
          stackNextBy: 0,
          enabled: true,
        },
        {
          ...project.routeVersions[0].instructions[0],
          kind: 'wait' as const,
          label: 'Wait',
          strength: 0,
          duration: 0.9,
          delayAfter: 0,
          stackNextBy: 0,
          enabled: true,
        },
      ],
    }

    const segments = compileInstructionSequence(route, layout.spawn)
    const forwardSegment = segments[1]
    const run = simulateRoute(segments, profile, layout, 13)
    const earlyCoast = run.trace.find((point) => point.time >= forwardSegment.scheduledEnd + 0.12)
    const lateCoast = run.trace.find((point) => point.time >= forwardSegment.scheduledEnd + 0.65)

    expect(earlyCoast).toBeDefined()
    expect(lateCoast).toBeDefined()
    expect((earlyCoast?.actualSpeed ?? 0)).toBeGreaterThan(6)
    expect((lateCoast?.actualSpeed ?? 0)).toBeLessThan(earlyCoast?.actualSpeed ?? Number.POSITIVE_INFINITY)
  })
})
