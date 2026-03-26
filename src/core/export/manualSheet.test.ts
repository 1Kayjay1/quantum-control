import { describe, expect, it } from 'vitest'

import { createStarterProject } from '../sampleProject'
import { formatManualSheet, manualSheetToText } from './manualSheet'

describe('manual route sheet', () => {
  it('produces human-readable steps instead of code', () => {
    const project = createStarterProject()
    const route = project.routeVersions[0]

    const sheet = formatManualSheet(route, null)
    const output = manualSheetToText(sheet)

    expect(sheet.steps[0]).toContain('1.')
    expect(output).toContain('Human-readable autonomous planning output')
    expect(output).not.toContain('function')
    expect(output).not.toContain('import ')
  })
})
