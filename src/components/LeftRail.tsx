import type { InstructionKind } from '../core/types'
import { useProjectStore } from '../store/projectStore'

interface ActionButtonDef {
  label: string
  hint: string
  kind: InstructionKind
}

const FLIGHT_CONTROLS: ActionButtonDef[] = [
  { label: 'Takeoff', hint: 'Lift into route.', kind: 'takeoff' },
  { label: 'Forward', hint: 'Pitch forward.', kind: 'moveForward' },
  { label: 'Backward', hint: 'Pitch backward.', kind: 'moveBackward' },
  { label: 'Yaw Left', hint: 'Rotate left.', kind: 'rotateCCW' },
  { label: 'Yaw Right', hint: 'Rotate right.', kind: 'rotateCW' },
  { label: 'Left Roll', hint: 'Strafe left.', kind: 'strafeLeft' },
  { label: 'Right Roll', hint: 'Strafe right.', kind: 'strafeRight' },
]

const MOVEMENT_INPUTS: ActionButtonDef[] = [
  { label: 'Up', hint: 'Throttle up.', kind: 'moveUp' },
  { label: 'Down', hint: 'Throttle down.', kind: 'moveDown' },
  { label: 'Hover', hint: 'Stabilize in place.', kind: 'hover' },
]

const UTILITY_ACTIONS: ActionButtonDef[] = [
  { label: 'Wait', hint: 'Pause the route.', kind: 'wait' },
  { label: 'Land', hint: 'Finish and settle.', kind: 'land' },
]

function RailSection({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions: ActionButtonDef[]
}) {
  const addInstruction = useProjectStore((state) => state.addInstruction)

  return (
    <section className="grid gap-4">
      <header className="grid gap-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">{title}</h2>
        <p className="text-sm leading-6 text-slate-500">{subtitle}</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="group grid min-h-20 content-start gap-1 rounded-xl border border-white/6 bg-white/[0.02] px-3.5 py-3 text-left transition hover:bg-white/[0.06] hover:text-white"
            onClick={() => addInstruction(action.kind)}
          >
            <strong className="text-sm font-semibold text-stone-100">{action.label}</strong>
            <span className="text-xs leading-5 text-slate-500 transition group-hover:text-slate-300">
              {action.hint}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function LeftRail() {
  return (
    <aside className="sticky top-[96px] self-start overflow-y-auto pr-2 scrollbar-thin max-[1320px]:static max-[1320px]:pr-0">
      <div className="grid gap-10">
        <div className="grid gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
            Control Inputs
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-stone-100">Flight Rail</h1>
          <p className="text-sm leading-6 text-slate-500">
            Build the route from held drone inputs. Select any event on the timeline to tune it in the drawer.
          </p>
        </div>

        <RailSection
          title="Flight Controls"
          subtitle="Takeoff plus pitch, roll, and yaw commands."
          actions={FLIGHT_CONTROLS}
        />

        <RailSection
          title="Movement"
          subtitle="Throttle and settle controls for altitude changes."
          actions={MOVEMENT_INPUTS}
        />

        <RailSection
          title="Utility"
          subtitle="Neutral holds and route finishers."
          actions={UTILITY_ACTIONS}
        />
      </div>
    </aside>
  )
}
