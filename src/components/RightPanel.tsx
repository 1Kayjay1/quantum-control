import { useShallow } from 'zustand/react/shallow'

import {
  getInstructionFamily,
  getMovementDirection,
  getMovementKind,
  getRotationDirection,
  getRotationKind,
  MOVEMENT_DIRECTION_OPTIONS,
  ROTATION_DIRECTION_OPTIONS,
} from '../core/instructions'
import { INSTRUCTION_LIBRARY } from '../core/presets'
import { findInstruction, getActiveRoute } from '../core/selectors'
import type { InstructionBlock, InstructionKind } from '../core/types'
import { useProjectStore } from '../store/projectStore'
import { NumberField, SelectField, TextAreaField, TextField } from './FormFields'
import { PanelSection } from './PanelSection'

function getInstructionLibraryLabel(kind: InstructionKind): string {
  return INSTRUCTION_LIBRARY.find((item) => item.kind === kind)?.label ?? kind
}

function buildDurationPatch(duration: number) {
  return { duration }
}

function renderInstructionFields(
  instruction: InstructionBlock,
  timingResolution: number,
  updateInstruction: (instructionId: string, patch: Partial<InstructionBlock>) => void,
) {
  const family = getInstructionFamily(instruction.kind)

  if (family === 'control' && instruction.kind !== 'rotateCW' && instruction.kind !== 'rotateCCW') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Input direction"
          value={getMovementDirection(instruction.kind)}
          options={MOVEMENT_DIRECTION_OPTIONS}
          onChange={(value) =>
            updateInstruction(instruction.id, {
              kind: getMovementKind(value),
              label: getInstructionLibraryLabel(getMovementKind(value)),
            })
          }
        />
        <NumberField
          label="Strength"
          value={instruction.strength}
          min={0}
          max={100}
          onChange={(value) => updateInstruction(instruction.id, { strength: value })}
        />
        <NumberField
          label="Hold time (s)"
          step={0.1}
          value={instruction.duration}
          onChange={(value) => updateInstruction(instruction.id, buildDurationPatch(value))}
        />
        <NumberField
          label="Delay after (s)"
          step={timingResolution}
          value={instruction.delayAfter}
          onChange={(value) => updateInstruction(instruction.id, { delayAfter: value })}
        />
        <NumberField
          label="Stack next by (s)"
          step={timingResolution}
          value={instruction.stackNextBy}
          onChange={(value) =>
            updateInstruction(instruction.id, {
              stackNextBy: value <= 0 ? 0 : Math.max(timingResolution, value),
            })
          }
        />
      </div>
    )
  }

  if (family === 'control') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Yaw direction"
          value={getRotationDirection(instruction.kind)}
          options={ROTATION_DIRECTION_OPTIONS}
          onChange={(value) =>
            updateInstruction(instruction.id, {
              kind: getRotationKind(value),
              label: getInstructionLibraryLabel(getRotationKind(value)),
            })
          }
        />
        <NumberField
          label="Strength"
          value={instruction.strength}
          min={0}
          max={100}
          onChange={(value) => updateInstruction(instruction.id, { strength: value })}
        />
        <NumberField
          label="Hold time (s)"
          step={0.1}
          value={instruction.duration}
          onChange={(value) => updateInstruction(instruction.id, buildDurationPatch(value))}
        />
        <NumberField
          label="Delay after (s)"
          step={timingResolution}
          value={instruction.delayAfter}
          onChange={(value) => updateInstruction(instruction.id, { delayAfter: value })}
        />
        <NumberField
          label="Stack next by (s)"
          step={timingResolution}
          value={instruction.stackNextBy}
          onChange={(value) =>
            updateInstruction(instruction.id, {
              stackNextBy: value <= 0 ? 0 : Math.max(timingResolution, value),
            })
          }
        />
      </div>
    )
  }

  if (family === 'timed') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Action"
          value={instruction.kind}
          options={[
            { label: 'Hover', value: 'hover' },
            { label: 'Wait', value: 'wait' },
          ]}
          onChange={(value) =>
            updateInstruction(instruction.id, {
              kind: value,
              label: getInstructionLibraryLabel(value),
            })
          }
        />
        <NumberField
          label="Hold time (s)"
          step={0.1}
          value={instruction.duration}
          onChange={(value) => updateInstruction(instruction.id, { duration: value })}
        />
        <NumberField
          label="Delay after (s)"
          step={timingResolution}
          value={instruction.delayAfter}
          onChange={(value) => updateInstruction(instruction.id, { delayAfter: value })}
        />
        <NumberField
          label="Stack next by (s)"
          step={timingResolution}
          value={instruction.stackNextBy}
          onChange={(value) =>
            updateInstruction(instruction.id, {
              stackNextBy: value <= 0 ? 0 : Math.max(timingResolution, value),
            })
          }
        />
      </div>
    )
  }

  if (family === 'takeoff') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          label="Duration (s)"
          step={0.1}
          value={instruction.duration}
          onChange={(value) => updateInstruction(instruction.id, buildDurationPatch(value))}
        />
        <NumberField
          label="Settle strength"
          value={instruction.strength}
          min={0}
          max={100}
          onChange={(value) => updateInstruction(instruction.id, { strength: value })}
        />
        <NumberField
          label="Delay after (s)"
          step={timingResolution}
          value={instruction.delayAfter}
          onChange={(value) => updateInstruction(instruction.id, { delayAfter: value })}
        />
        <NumberField
          label="Stack next by (s)"
          step={timingResolution}
          value={instruction.stackNextBy}
          onChange={(value) =>
            updateInstruction(instruction.id, {
              stackNextBy: value <= 0 ? 0 : Math.max(timingResolution, value),
            })
          }
        />
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <NumberField
        label="Duration (s)"
        step={0.1}
        value={instruction.duration}
        onChange={(value) => updateInstruction(instruction.id, { duration: value })}
      />
      <NumberField
        label="Delay after (s)"
        step={timingResolution}
        value={instruction.delayAfter}
        onChange={(value) => updateInstruction(instruction.id, { delayAfter: value })}
      />
      <NumberField
        label="Stack next by (s)"
        step={timingResolution}
        value={instruction.stackNextBy}
        onChange={(value) =>
          updateInstruction(instruction.id, {
            stackNextBy: value <= 0 ? 0 : Math.max(timingResolution, value),
          })
        }
      />
    </div>
  )
}

export function RightPanel({
  flat = false,
}: {
  flat?: boolean
}) {
  const { project, activeRouteId, selectedInstructionId, updateInstruction } = useProjectStore(
    useShallow((state) => ({
      project: state.project,
      activeRouteId: state.activeRouteId,
      selectedInstructionId: state.selectedInstructionId,
      updateInstruction: state.updateInstruction,
    })),
  )

  const activeRoute = getActiveRoute(project, activeRouteId)
  const selectedInstruction = findInstruction(activeRoute, selectedInstructionId)
  const selectedInstructionIndex = selectedInstruction
    ? activeRoute.instructions.findIndex((instruction) => instruction.id === selectedInstruction.id) + 1
    : null
  const groupClass = flat
    ? 'grid gap-4 border-t border-white/8 pt-4'
    : 'grid gap-4 rounded-[22px] border border-white/8 bg-white/[0.02] p-4'
  const sectionClass = flat
    ? 'grid gap-5 border-t border-white/8 pt-4'
    : 'grid gap-5 rounded-[22px] border border-white/8 bg-white/[0.02] p-4'
  const emptyClass = flat
    ? 'border-t border-dashed border-white/10 px-0 py-5 text-sm leading-6 text-slate-500'
    : 'rounded-[22px] border border-dashed border-white/10 bg-white/[0.015] px-4 py-5 text-sm leading-6 text-slate-500'

  return (
    <section className="grid gap-6">
      <PanelSection
        title="Event Settings"
        subtitle="Tune the selected route event. Primary control values live first; note, tags, and enable state stay lower."
      >
        {selectedInstruction ? (
          <>
            <div className={groupClass}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                  Step {String(selectedInstructionIndex).padStart(2, '0')}
                </span>
                <span className="rounded-full bg-blue-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200">
                  {getInstructionFamily(selectedInstruction.kind)}
                </span>
                <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {selectedInstruction.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <TextField
                label="Action label"
                value={selectedInstruction.label}
                onChange={(value) => updateInstruction(selectedInstruction.id, { label: value })}
              />
            </div>

            <div className={sectionClass}>
              <div className="grid gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Control Values
                </span>
                <p className="text-sm leading-6 text-slate-500">
                  Direction, strength, and scheduling values for the selected event.
                </p>
              </div>
              {renderInstructionFields(selectedInstruction, activeRoute.timingResolution, updateInstruction)}
            </div>

            <div className={sectionClass}>
              <div className="grid gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Metadata
                </span>
                <p className="text-sm leading-6 text-slate-500">
                  Use notes and tags to explain why the event exists or how it should be tuned later.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Version tag"
                  value={selectedInstruction.versionTag}
                  onChange={(value) => updateInstruction(selectedInstruction.id, { versionTag: value })}
                />
                <label className="grid gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Enabled
                  </span>
                  <div className="flex h-[48px] items-center justify-between rounded-2xl border border-white/8 bg-[#0b1321]/78 px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <span className="text-sm text-slate-300">Use in route</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-amber-400"
                      checked={selectedInstruction.enabled}
                      onChange={(event) =>
                        updateInstruction(selectedInstruction.id, {
                          enabled: event.target.checked,
                        })
                      }
                    />
                  </div>
                </label>
              </div>

              <TextAreaField
                label="Step note"
                value={selectedInstruction.note}
                onChange={(value) => updateInstruction(selectedInstruction.id, { note: value })}
              />

              <p className="text-sm leading-6 text-slate-500">
                `Stack next by` starts the following input early. Use the timeline for timing, then verify the result in replay.
              </p>
            </div>
          </>
        ) : (
          <div className={emptyClass}>
            Select an event on the timeline to edit its direction, strength, hold time, and note.
          </div>
        )}
      </PanelSection>
    </section>
  )
}
