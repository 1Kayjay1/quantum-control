export type LayoutPrototype = 'mission-control-balanced' | 'viewport-first-tactical' | 'timeline-first-sequencer'

export const LAYOUT_PROTOTYPES: Array<{
  id: LayoutPrototype
  shortLabel: string
  label: string
}> = [
  {
    id: 'mission-control-balanced',
    shortLabel: 'A',
    label: 'Mission Control Balanced',
  },
  {
    id: 'viewport-first-tactical',
    shortLabel: 'B',
    label: 'Viewport First Tactical',
  },
  {
    id: 'timeline-first-sequencer',
    shortLabel: 'C',
    label: 'Timeline First Sequencer',
  },
]
