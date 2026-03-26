import { describe, expect, it } from 'vitest'

import { DRONE_DIMENSIONS_WORLD } from '../constants'
import { computeDroneProxyBounds, DRONE_SCORING_PROXY_COMPONENTS } from '../droneCollision'
import { createStarterProject } from '../sampleProject'
import { compileInstructionSequence } from './compile'
import { simulateRoute } from './simulate'

function collisionSeverityRank(severity: 'brush' | 'bump' | 'hard') {
  switch (severity) {
    case 'brush':
      return 1
    case 'bump':
      return 2
    case 'hard':
      return 3
  }
}

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
    const headingOffsetRange = run.trace.reduce((maxOffset, point) => {
      const offset = Math.abs(((point.actualHeading - layout.spawn.heading + 540) % 360) - 180)
      return Math.max(maxOffset, offset)
    }, 0)

    expect(headingOffsetRange).toBeLessThan(20)
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

  it('produces different actual paths for different seeds under randomized conditions', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const layout = project.fieldLayouts[0]
    const profile = {
      ...project.behaviorProfiles[0],
      randomizeConditions: true,
      randomizationPct: 0.45,
    }
    const segments = compileInstructionSequence(route, layout.spawn)

    const runA = simulateRoute(segments, profile, layout, 21)
    const runB = simulateRoute(segments, profile, layout, 22)
    const sampleCount = Math.min(runA.trace.length, runB.trace.length)
    let maxPointDelta = 0

    for (let index = 0; index < sampleCount; index += 1) {
      const pointA = runA.trace[index]
      const pointB = runB.trace[index]
      const delta = Math.hypot(
        pointA.actualPosition.x - pointB.actualPosition.x,
        pointA.actualPosition.y - pointB.actualPosition.y,
        pointA.actualPosition.z - pointB.actualPosition.z,
      )
      maxPointDelta = Math.max(maxPointDelta, delta)
    }

    expect(maxPointDelta).toBeGreaterThan(4)
  })

  it('blends overlapping movement commands instead of snapping to a single axis', () => {
    const project = createStarterProject()
    const layout = project.fieldLayouts[0]
    const profile = {
      ...project.behaviorProfiles[1],
      randomizeConditions: false,
    }
    const route = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[0], kind: 'takeoff' as const, delayAfter: 0.1 },
        {
          ...project.routeVersions[0].instructions[1],
          kind: 'moveForward' as const,
          label: 'Forward',
          strength: 48,
          duration: 0.8,
          delayAfter: 0,
          stackNextBy: 0.3,
          enabled: true,
        },
        {
          ...project.routeVersions[0].instructions[4],
          kind: 'strafeRight' as const,
          label: 'Right',
          strength: 44,
          duration: 0.75,
          delayAfter: 0,
          stackNextBy: 0,
          enabled: true,
        },
      ],
    }

    const segments = compileInstructionSequence(route, layout.spawn)
    const run = simulateRoute(segments, profile, layout, 33)
    const overlapTrace = run.trace.filter(
      (point) => point.time >= segments[2].scheduledStart && point.time <= segments[1].scheduledEnd,
    )
    const xTravel =
      (overlapTrace.at(-1)?.actualPosition.x ?? 0) - (overlapTrace[0]?.actualPosition.x ?? 0)
    const zTravel =
      (overlapTrace.at(-1)?.actualPosition.z ?? 0) - (overlapTrace[0]?.actualPosition.z ?? 0)

    expect(overlapTrace.length).toBeGreaterThan(0)
    expect(Math.abs(xTravel)).toBeGreaterThan(2)
    expect(Math.abs(zTravel)).toBeGreaterThan(2)
  })

  it('lets collision aftermath push the actual path further off line than a no-contact run', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const baseLayout = project.fieldLayouts[0]
    const collisionLayout = structuredClone(baseLayout)
    collisionLayout.objects.push({
      id: 'audit-wall',
      type: 'wall',
      name: 'Test Wall',
      position: { x: -160, y: 55, z: -118 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { x: 12, y: 110, z: 120 },
      color: '#ff5b5b',
      isSolid: true,
      windResponsive: false,
      note: 'Injected for collision aftermath test.',
    })
    const profile = {
      ...project.behaviorProfiles[1],
      randomizeConditions: false,
    }
    const segments = compileInstructionSequence(route, baseLayout.spawn)

    const cleanRun = simulateRoute(segments, profile, baseLayout, 41)
    const collisionRun = simulateRoute(segments, profile, collisionLayout, 41)

    expect(collisionRun.metrics.collisionCount).toBeGreaterThan(cleanRun.metrics.collisionCount)
    expect(collisionRun.metrics.pathDeviation).toBeGreaterThan(cleanRun.metrics.pathDeviation + 5)
  })

  it('dedupes repeated contact with the same object into one collision event during the cooldown window', () => {
    const project = createStarterProject()
    const layout = structuredClone(project.fieldLayouts[0])
    layout.objects = [
      {
        id: 'gate-wall',
        type: 'wall',
        name: 'Gate Wall',
        position: { x: -188, y: 55, z: -120 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 28, y: 110, z: 140 },
        color: '#ff6b6b',
        isSolid: true,
        windResponsive: false,
        note: '',
      },
    ]
    layout.missionCheckpoints = []
    const route = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[0], kind: 'takeoff' as const, delayAfter: 0.1 },
        { ...project.routeVersions[0].instructions[1], kind: 'moveForward' as const, strength: 26, duration: 0.42, delayAfter: 0 },
      ],
    }
    const profile = { ...project.behaviorProfiles[1], randomizeConditions: false }
    const run = simulateRoute(compileInstructionSequence(route, layout.spawn), profile, layout, 51)
    const wallEvents = run.collisionEvents.filter((event) => event.objectId === 'gate-wall')
    const collisionMarkers = run.failureMarkers.filter((marker) => marker.type === 'collision')

    expect(wallEvents.length).toBeLessThanOrEqual(2)
    expect(wallEvents[0].rawContactCount).toBeGreaterThanOrEqual(wallEvents.length)
    expect(collisionMarkers).toHaveLength(run.collisionEvents.length)
  })

  it('creates separate collision events when the same object is hit again after leaving contact', () => {
    const project = createStarterProject()
    const layout = structuredClone(project.fieldLayouts[0])
    layout.objects = [
      {
        id: 'repeat-wall',
        type: 'wall',
        name: 'Repeat Wall',
        position: { x: -182, y: 55, z: -120 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 10, y: 110, z: 120 },
        color: '#ff6b6b',
        isSolid: true,
        windResponsive: false,
        note: '',
      },
    ]
    layout.missionCheckpoints = []
    const route = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[0], kind: 'takeoff' as const, delayAfter: 0.1 },
        { ...project.routeVersions[0].instructions[1], kind: 'moveForward' as const, strength: 50, duration: 0.7, delayAfter: 0.1 },
        { ...project.routeVersions[0].instructions[1], kind: 'moveBackward' as const, label: 'Back Out', strength: 54, duration: 0.75, delayAfter: 0.35 },
        { ...project.routeVersions[0].instructions[1], kind: 'moveForward' as const, label: 'Hit Again', strength: 55, duration: 0.75, delayAfter: 0 },
      ],
    }
    const profile = { ...project.behaviorProfiles[1], randomizeConditions: false }
    const run = simulateRoute(compileInstructionSequence(route, layout.spawn), profile, layout, 52)
    const wallEvents = run.collisionEvents.filter((event) => event.objectId === 'repeat-wall')

    expect(wallEvents.length).toBeGreaterThanOrEqual(2)
  })

  it('classifies a stronger impact as more severe than a soft brush', () => {
    const project = createStarterProject()
    const baseLayout = structuredClone(project.fieldLayouts[0])
    baseLayout.objects = [
      {
        id: 'severity-wall',
        type: 'wall',
        name: 'Severity Wall',
        position: { x: -198, y: 55, z: -120 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 10, y: 110, z: 120 },
        color: '#ff6b6b',
        isSolid: true,
        windResponsive: false,
        note: '',
      },
    ]
    baseLayout.missionCheckpoints = []
    const profile = { ...project.behaviorProfiles[1], randomizeConditions: false }

    const softRoute = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[0], kind: 'takeoff' as const, delayAfter: 0.1 },
        { ...project.routeVersions[0].instructions[1], kind: 'moveForward' as const, strength: 20, duration: 0.35, delayAfter: 0 },
      ],
    }
    const hardRoute = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[0], kind: 'takeoff' as const, delayAfter: 0.1 },
        { ...project.routeVersions[0].instructions[1], kind: 'moveForward' as const, strength: 68, duration: 0.85, delayAfter: 0 },
      ],
    }

    const softRun = simulateRoute(compileInstructionSequence(softRoute, baseLayout.spawn), profile, baseLayout, 53)
    const hardRun = simulateRoute(compileInstructionSequence(hardRoute, baseLayout.spawn), profile, baseLayout, 54)
    const softSeverity = softRun.collisionEvents[0]?.severity
    const hardSeverity = hardRun.collisionEvents[0]?.severity

    expect(softSeverity).toBeDefined()
    expect(hardSeverity).toBeDefined()
    expect(collisionSeverityRank(hardSeverity!)).toBeGreaterThanOrEqual(collisionSeverityRank(softSeverity!))
  })

  it('keeps the scoring proxy within the real drone envelope tolerance', () => {
    const bounds = computeDroneProxyBounds(DRONE_SCORING_PROXY_COMPONENTS)

    expect(Math.abs(bounds.size.x - DRONE_DIMENSIONS_WORLD.width)).toBeLessThan(0.03)
    expect(Math.abs(bounds.size.y - DRONE_DIMENSIONS_WORLD.height)).toBeLessThan(0.03)
    expect(Math.abs(bounds.size.z - DRONE_DIMENSIONS_WORLD.length)).toBeLessThan(0.03)
  })

  it('stores a representative world-space contact point instead of only the drone center', () => {
    const project = createStarterProject()
    const layout = structuredClone(project.fieldLayouts[0])
    layout.objects = [
      {
        id: 'contact-wall',
        type: 'wall',
        name: 'Contact Wall',
        position: { x: -188, y: 55, z: -120 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 18, y: 110, z: 120 },
        color: '#ff6b6b',
        isSolid: true,
        windResponsive: false,
        note: '',
      },
    ]
    layout.missionCheckpoints = []
    const route = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[0], kind: 'takeoff' as const, delayAfter: 0.1 },
        { ...project.routeVersions[0].instructions[1], kind: 'moveForward' as const, strength: 42, duration: 0.55, delayAfter: 0 },
      ],
    }
    const profile = { ...project.behaviorProfiles[1], randomizeConditions: false }
    const run = simulateRoute(compileInstructionSequence(route, layout.spawn), profile, layout, 61)
    const collision = run.collisionEvents[0]

    expect(collision).toBeDefined()
    expect(Math.hypot(
      collision!.representativeNormal.x,
      collision!.representativeNormal.y,
      collision!.representativeNormal.z,
    )).toBeGreaterThan(0.5)

    const contactTracePoint =
      run.trace.find((point) => point.time >= collision!.firstContactTime) ?? run.trace.at(-1)!
    const centerDelta = Math.hypot(
      collision!.representativeContactPoint.x - contactTracePoint.actualPosition.x,
      collision!.representativeContactPoint.y - contactTracePoint.actualPosition.y,
      collision!.representativeContactPoint.z - contactTracePoint.actualPosition.z,
    )
    expect(centerDelta).toBeGreaterThan(1)
  })

  it('does not inject unrealistic upward velocity on a horizontal wall impact', () => {
    const project = createStarterProject()
    const layout = structuredClone(project.fieldLayouts[0])
    layout.spawn.position.y = 60
    layout.objects = [
      {
        id: 'flat-wall',
        type: 'wall',
        name: 'Flat Wall',
        position: { x: -170, y: 60, z: -120 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 12, y: 110, z: 120 },
        color: '#ff6b6b',
        isSolid: true,
        windResponsive: false,
        note: '',
      },
    ]
    layout.missionCheckpoints = []
    const route = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[1], kind: 'moveForward' as const, strength: 60, duration: 0.72, delayAfter: 0 },
      ],
    }
    const profile = { ...project.behaviorProfiles[1], randomizeConditions: false }
    const run = simulateRoute(compileInstructionSequence(route, layout.spawn), profile, layout, 62)
    const cleanRun = simulateRoute(compileInstructionSequence(route, layout.spawn), profile, { ...layout, objects: [], missionCheckpoints: [] }, 62)
    const collision = run.collisionEvents[0]
    const afterImpact =
      run.trace.find((point) => point.time > (collision?.lastContactTime ?? 0) + 0.08) ?? run.trace.at(-1)!
    const cleanAfterImpact =
      cleanRun.trace.find((point) => point.time >= afterImpact.time) ?? cleanRun.trace.at(-1)!

    expect(collision).toBeDefined()
    expect(Math.abs(afterImpact.actualPosition.y - cleanAfterImpact.actualPosition.y)).toBeLessThanOrEqual(12)
  })

  it('produces meaningful contact-side data against a rotated obstacle', () => {
    const project = createStarterProject()
    const layout = structuredClone(project.fieldLayouts[0])
    layout.objects = [
      {
        id: 'rotated-wall',
        type: 'wall',
        name: 'Rotated Wall',
        position: { x: -185, y: 55, z: -104 },
        rotation: { x: 0, y: 35, z: 0 },
        size: { x: 14, y: 110, z: 110 },
        color: '#ff6b6b',
        isSolid: true,
        windResponsive: false,
        note: '',
      },
    ]
    layout.missionCheckpoints = []
    const route = {
      ...project.routeVersions[0],
      instructions: [
        { ...project.routeVersions[0].instructions[0], kind: 'takeoff' as const, delayAfter: 0.12 },
        { ...project.routeVersions[0].instructions[1], kind: 'moveForward' as const, strength: 48, duration: 0.66, delayAfter: 0 },
      ],
    }
    const profile = { ...project.behaviorProfiles[1], randomizeConditions: false }
    const run = simulateRoute(compileInstructionSequence(route, layout.spawn), profile, layout, 63)
    const collision = run.collisionEvents[0]

    expect(collision).toBeDefined()
    expect(Math.hypot(
      collision!.representativeNormal.x,
      collision!.representativeNormal.y,
      collision!.representativeNormal.z,
    )).toBeGreaterThan(0.5)
    expect(collision!.representativeContactPoint).not.toEqual(run.trace[0]?.actualPosition)
  })
})
