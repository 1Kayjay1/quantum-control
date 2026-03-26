import type { InstructionKind } from '../core/types'
import { useProjectStore } from '../store/projectStore'
import { PanelSection } from './PanelSection'

interface ActionButtonDef {
  label: string
  hint: string
  kind: InstructionKind
}

const FLIGHT_CONTROLS: ActionButtonDef[] = [
  { label: 'Takeoff', hint: 'Lift into the route.', kind: 'takeoff' },
  { label: 'Forward', hint: 'Hold pitch forward.', kind: 'moveForward' },
  { label: 'Backward', hint: 'Hold pitch backward.', kind: 'moveBackward' },
  { label: 'Yaw Left', hint: 'Hold yaw left.', kind: 'rotateCCW' },
  { label: 'Yaw Right', hint: 'Hold yaw right.', kind: 'rotateCW' },
  { label: 'Left Roll', hint: 'Hold roll left.', kind: 'strafeLeft' },
  { label: 'Right Roll', hint: 'Hold roll right.', kind: 'strafeRight' },
]

const MOVEMENT_INPUTS: ActionButtonDef[] = [
  { label: 'Up', hint: 'Hold throttle up.', kind: 'moveUp' },
  { label: 'Down', hint: 'Hold throttle down.', kind: 'moveDown' },
  { label: 'Hover', hint: 'Stabilize in place.', kind: 'hover' },
]

const UTILITY_ACTIONS: ActionButtonDef[] = [
  { label: 'Wait', hint: 'Pause before next event.', kind: 'wait' },
  { label: 'Land', hint: 'Finish the route safely.', kind: 'land' },
]

function ActionSection({
  title,
  subtitle,
  actions,
  compact = false,
}: {
  title: string
  subtitle: string
  actions: ActionButtonDef[]
  compact?: boolean
}) {
  const addInstruction = useProjectStore((state) => state.addInstruction)

  return (
    <PanelSection title={title} subtitle={subtitle} collapsible defaultOpen>
      <div className={`action-grid${compact ? ' action-grid--compact' : ''}`}>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="action-button"
            onClick={() => addInstruction(action.kind)}
          >
            <strong>{action.label}</strong>
            <span>{action.hint}</span>
          </button>
        ))}
      </div>
    </PanelSection>
  )
}

export function LeftPanel() {
  return (
    <section className="panel panel--actions">
      <div className="sidebar-header">
        <span className="sidebar-header__eyebrow">Control Inputs</span>
        <h2>Flight Actions</h2>
        <p>Build the route from held drone inputs, then tune the selected event from the right panel.</p>
      </div>

      <ActionSection
        title="Flight Controls"
        subtitle="Takeoff plus pitch, yaw, and roll inputs."
        actions={FLIGHT_CONTROLS}
      />

      <ActionSection
        title="Movement Inputs"
        subtitle="Throttle and settle controls for altitude changes."
        actions={MOVEMENT_INPUTS}
        compact
      />

      <ActionSection
        title="Utility"
        subtitle="Neutral holds and route finishers."
        actions={UTILITY_ACTIONS}
        compact
      />
    </section>
  )
}
