import { formatInstructionLabel, formatMetricsSummary } from '../formatters'
import type { ManualRouteSheet, RouteVersion, SimulationRun } from '../types'

export function formatManualSheet(
  routeVersion: RouteVersion,
  run: SimulationRun | null,
): ManualRouteSheet {
  const steps = routeVersion.instructions
    .filter((instruction) => instruction.enabled)
    .map((instruction, index) => {
      const detail = formatInstructionLabel(instruction)
      const note = instruction.note ? ` | Note: ${instruction.note}` : ''
      const delay = instruction.delayAfter > 0 ? ` | Delay: ${instruction.delayAfter.toFixed(1)} s` : ''
      return `${index + 1}. ${detail}${delay}${note}`
    })

  return {
    title: `Quantum Control Manual Sheet - ${routeVersion.name}`,
    subtitle:
      'Human-readable autonomous planning output. Transfer each step manually into the official coding platform.',
    warning:
      'This sheet is not drone-executable code and does not connect to the aircraft or replace the official competition environment.',
    steps,
    summary: run
      ? formatMetricsSummary(run.metrics)
      : ['Run a simulation to generate timing and risk notes.'],
  }
}

export function manualSheetToText(sheet: ManualRouteSheet): string {
  return [
    sheet.title,
    sheet.subtitle,
    '',
    sheet.warning,
    '',
    ...sheet.summary,
    '',
    ...sheet.steps,
  ].join('\n')
}
