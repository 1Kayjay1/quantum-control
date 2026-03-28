import { useState } from 'react'

import type { InstructionKind, FieldObjectType } from '../core/types'
import { useProjectStore } from '../store/projectStore'
import type { LayoutPrototype } from '../ui/layoutPrototype'

interface ActionButtonDef {
  label: string
  hint: string
  kind?: InstructionKind
  objectType?: FieldObjectType
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
  { label: 'Wait', hint: 'Pause without drift.', kind: 'wait' },
  { label: 'Land', hint: 'Finish and settle.', kind: 'land' },
]

const FIELD_TOOLS: ActionButtonDef[] = [
  { label: 'Wall', hint: 'Add boundary or blocker.', objectType: 'wall' },
  { label: 'Arch Gate', hint: 'Mission gate object.', objectType: 'archGate' },
  { label: 'Tunnel', hint: 'Straight tunnel section.', objectType: 'tunnel' },
  { label: 'Landing Pad', hint: 'Landing target zone.', objectType: 'landingPad' },
]

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <header className="grid gap-1">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">{title}</h2>
      <p className="text-sm leading-6 text-slate-500">{subtitle}</p>
    </header>
  )
}

function RailButton({
  action,
  compact = false,
}: {
  action: ActionButtonDef
  compact?: boolean
}) {
  const addInstruction = useProjectStore((state) => state.addInstruction)
  const addFieldObject = useProjectStore((state) => state.addFieldObject)

  return (
    <button
      type="button"
      className={`group grid content-start gap-1 rounded-2xl border border-white/7 bg-white/[0.025] px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-white/12 hover:bg-white/[0.055] ${
        compact ? 'min-h-[60px]' : 'min-h-[78px]'
      }`}
      onClick={() => {
        if (action.kind) {
          addInstruction(action.kind)
          return
        }
        if (action.objectType) {
          addFieldObject(action.objectType)
        }
      }}
    >
      <strong className="text-sm font-semibold text-stone-100">{action.label}</strong>
      {!compact ? (
        <span className="text-xs leading-5 text-slate-500 transition group-hover:text-slate-300">
          {action.hint}
        </span>
      ) : null}
    </button>
  )
}

function RailSection({
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
  return (
    <section className="grid gap-4 border-t border-white/8 pt-6 first:border-t-0 first:pt-0">
      {!compact ? <SectionHeader title={title} subtitle={subtitle} /> : <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">{title}</h2>}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <RailButton key={action.label} action={action} compact={compact} />
        ))}
      </div>
    </section>
  )
}

export function LeftRail({
  layoutPrototype,
}: {
  layoutPrototype: LayoutPrototype
}) {
  const snapToGrid = useProjectStore((state) => state.snapToGrid)
  const setSnapToGrid = useProjectStore((state) => state.setSnapToGrid)
  const [collapsed, setCollapsed] = useState(false)
  const compact = collapsed || layoutPrototype !== 'mission-control-balanced'

  return (
    <aside
      className={`h-full overflow-y-auto pr-2 scrollbar-thin max-[1320px]:pr-0 ${
        layoutPrototype === 'mission-control-balanced' ? 'max-h-full' : 'max-h-full'
      }`}
    >
      <div
        className={`grid rounded-[20px] border border-white/8 bg-[#09111c]/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
          collapsed ? 'gap-5 px-3 py-4' : 'gap-6 px-4 py-4'
        }`}
      >
        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-amber-300/70">
                Build Shelf
              </span>
              {!collapsed ? (
                <>
                  <h1 className="text-[1.35rem] font-semibold tracking-[-0.04em] text-stone-100">
                    Route Tools
                  </h1>
                  <p className="text-sm leading-5 text-slate-500">
                    Treat this like a tool browser: inputs first, field pieces second, alignment controls last.
                  </p>
                </>
              ) : null}
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              onClick={() => setCollapsed((current) => !current)}
            >
              {collapsed ? 'Open' : 'Collapse'}
            </button>
          </div>
        </div>

        <RailSection
          title="Flight Controls"
          subtitle="Takeoff plus pitch, roll, and yaw commands."
          actions={FLIGHT_CONTROLS}
          compact={compact}
        />

        <RailSection
          title="Movement"
          subtitle="Throttle and utility moves for hover, waits, and landing."
          actions={MOVEMENT_INPUTS}
          compact={compact}
        />

        <section className="grid gap-4 border-t border-white/8 pt-6">
          {!compact ? (
            <SectionHeader
              title="Field Tools"
              subtitle="Drop common course objects directly into the active layout."
            />
          ) : (
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Field Tools</h2>
          )}
          <div className="grid grid-cols-2 gap-3">
            {FIELD_TOOLS.map((action) => (
              <RailButton key={action.label} action={action} compact={compact} />
            ))}
          </div>
          <label className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
            <div className="grid gap-0.5">
              <span className="text-sm font-medium text-slate-200">Snap to grid</span>
              {!compact ? (
                <span className="text-xs text-slate-500">Keep placements aligned to the mission grid.</span>
              ) : null}
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-amber-400"
              checked={snapToGrid}
              onChange={(event) => setSnapToGrid(event.target.checked)}
            />
          </label>
        </section>
      </div>
    </aside>
  )
}
