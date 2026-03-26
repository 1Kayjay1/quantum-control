import { describe, expect, it } from 'vitest'

import { createStarterProject } from '../sampleProject'
import { compileInstructionSequence } from './compile'

describe('compileInstructionSequence', () => {
  it('builds an ordered plan from spawn to final pose', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const layout = project.fieldLayouts[0]

    const segments = compileInstructionSequence(route, layout.spawn)
    const firstSegment = segments[0]
    const lastSegment = segments[segments.length - 1]

    expect(segments.length).toBe(route.instructions.length)
    expect(firstSegment.startPose.position).toEqual(layout.spawn.position)
    expect(lastSegment.endPose.position.y).toBe(0)
    expect(lastSegment.endPose.airborne).toBe(false)
  })

  it('supports stacked input scheduling', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]
    const layout = project.fieldLayouts[0]
    route.instructions[1].stackNextBy = route.timingResolution

    const segments = compileInstructionSequence(route, layout.spawn)

    expect(segments[2].scheduledStart).toBeLessThan(segments[1].scheduledEnd)
  })
})
