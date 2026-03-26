import { useShallow } from 'zustand/react/shallow'

import type { BehaviorProfile, FieldObject, FieldObjectType } from '../core/types'
import {
  findFieldObject,
  getActiveBehaviorProfile,
  getActiveLayout,
  getActiveRoute,
} from '../core/selectors'
import { useProjectStore } from '../store/projectStore'
import { NumberField, SliderField, TextAreaField, TextField } from './FormFields'
import { PanelSection } from './PanelSection'

const FIELD_BUTTONS: Array<{ label: string; type: FieldObjectType }> = [
  { label: 'Wall', type: 'wall' },
  { label: 'Arch Gate', type: 'archGate' },
  { label: 'Keyhole Gate', type: 'keyholeGate' },
  { label: 'Tunnel', type: 'tunnel' },
  { label: 'Panel', type: 'flyThroughPanel' },
  { label: 'Color Mat', type: 'colorMat' },
  { label: 'Landing Pad', type: 'landingPad' },
  { label: 'Large Cube', type: 'cubeLarge' },
  { label: 'Small Cube', type: 'cubeSmall' },
  { label: 'Mini Arch', type: 'miniArchGate' },
  { label: 'Pillar', type: 'pillar' },
  { label: 'Marker', type: 'marker' },
]

const CHECKPOINT_TYPES = new Set([
  'gate',
  'ring',
  'landingZone',
  'scoringZone',
  'archGate',
  'keyholeGate',
  'tunnel',
  'flyThroughPanel',
  'colorMat',
  'landingPad',
  'miniArchGate',
])

function SimulationFields({
  profile,
  onChange,
}: {
  profile: BehaviorProfile
  onChange: (patch: Partial<BehaviorProfile>) => void
}) {
  return (
    <div className="grid gap-4">
      <TextField
        label="Condition preset"
        value={profile.name}
        onChange={(value) => onChange({ name: value })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          label="Mass (kg)"
          step={0.0001}
          value={profile.massKg}
          onChange={(value) => onChange({ massKg: value })}
        />
        <NumberField
          label="Hover assist"
          step={0.01}
          value={profile.hoverAssistPct}
          onChange={(value) => onChange({ hoverAssistPct: value })}
        />
        <NumberField
          label="Hover brake assist"
          step={0.01}
          value={profile.hoverBrakeAssistPct}
          onChange={(value) => onChange({ hoverBrakeAssistPct: value })}
        />
        <NumberField
          label="Altitude hold gain"
          step={0.1}
          value={profile.altitudeHoldGain}
          onChange={(value) => onChange({ altitudeHoldGain: value })}
        />
        <NumberField
          label="Attitude hold gain"
          step={0.05}
          value={profile.attitudeHoldGain}
          onChange={(value) => onChange({ attitudeHoldGain: value })}
        />
        <NumberField
          label="Ref velocity blend"
          step={0.01}
          value={profile.referenceVelocityBlend}
          onChange={(value) => onChange({ referenceVelocityBlend: value })}
        />
        <NumberField
          label="Ref position gain"
          step={0.01}
          value={profile.referencePositionGain}
          onChange={(value) => onChange({ referencePositionGain: value })}
        />
        <NumberField
          label="Ref heading assist"
          step={0.01}
          value={profile.referenceHeadingAssist}
          onChange={(value) => onChange({ referenceHeadingAssist: value })}
        />
      </div>
      <SliderField
        label="Drift offset"
        min={-18}
        max={18}
        step={0.5}
        value={profile.driftLateralCmPerMeter}
        display={`${profile.driftLateralCmPerMeter.toFixed(1)} cm/m`}
        onChange={(value) => onChange({ driftLateralCmPerMeter: value })}
      />
      <SliderField
        label="Forward bias"
        min={-12}
        max={12}
        step={0.5}
        value={profile.driftForwardCmPerMeter}
        display={`${profile.driftForwardCmPerMeter.toFixed(1)} cm/m`}
        onChange={(value) => onChange({ driftForwardCmPerMeter: value })}
      />
      <SliderField
        label="Overshoot factor"
        min={0}
        max={0.2}
        step={0.01}
        value={profile.overshootPct}
        display={`${Math.round(profile.overshootPct * 100)}%`}
        onChange={(value) => onChange({ overshootPct: value })}
      />
      <SliderField
        label="Turn delay"
        min={0}
        max={500}
        step={10}
        value={profile.turnDelayMs}
        display={`${Math.round(profile.turnDelayMs)} ms`}
        onChange={(value) => onChange({ turnDelayMs: value })}
      />
      <SliderField
        label="Speed variance"
        min={0}
        max={0.18}
        step={0.01}
        value={profile.speedVariationPct}
        display={`${Math.round(profile.speedVariationPct * 100)}%`}
        onChange={(value) => onChange({ speedVariationPct: value })}
      />
      <label className="flex items-center justify-between gap-4 border-b border-white/8 py-2">
        <span className="text-sm text-slate-400">Randomize each sim run</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-amber-400"
          checked={profile.randomizeConditions}
          onChange={(event) => onChange({ randomizeConditions: event.target.checked })}
        />
      </label>
      <SliderField
        label="Randomization strength"
        min={0}
        max={0.45}
        step={0.01}
        value={profile.randomizationPct}
        display={`${Math.round(profile.randomizationPct * 100)}%`}
        onChange={(value) => onChange({ randomizationPct: value })}
      />
      <SliderField
        label="Gust strength"
        min={0}
        max={45}
        step={1}
        value={profile.gustStrengthCmS2}
        display={`${Math.round(profile.gustStrengthCmS2)} cm/s^2`}
        onChange={(value) => onChange({ gustStrengthCmS2: value })}
      />
      <SliderField
        label="Prop wash"
        min={0}
        max={1.2}
        step={0.02}
        value={profile.propWashStrength}
        display={profile.propWashStrength.toFixed(2)}
        onChange={(value) => onChange({ propWashStrength: value })}
      />
      <SliderField
        label="Object draft"
        min={0}
        max={1.2}
        step={0.02}
        value={profile.objectDraftStrength}
        display={profile.objectDraftStrength.toFixed(2)}
        onChange={(value) => onChange({ objectDraftStrength: value })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          label="Turn response"
          step={0.01}
          value={profile.turnResponsePct}
          onChange={(value) => onChange({ turnResponsePct: value })}
        />
        <NumberField
          label="Carry pct"
          step={0.01}
          value={profile.carryPct}
          onChange={(value) => onChange({ carryPct: value })}
        />
        <NumberField
          label="Coast duration ms"
          value={profile.coastDurationMs}
          onChange={(value) => onChange({ coastDurationMs: value })}
        />
        <NumberField
          label="Ref assist in coast"
          step={0.01}
          value={profile.referenceAssistDuringCoastPct}
          onChange={(value) => onChange({ referenceAssistDuringCoastPct: value })}
        />
        <NumberField
          label="Reaction delay ms"
          value={profile.reactionDelayMs}
          onChange={(value) => onChange({ reactionDelayMs: value })}
        />
        <NumberField
          label="Drag"
          step={0.01}
          value={profile.dragPct}
          onChange={(value) => onChange({ dragPct: value })}
        />
        <NumberField
          label="Vertical drift / m"
          step={0.1}
          value={profile.driftVerticalCmPerMeter}
          onChange={(value) => onChange({ driftVerticalCmPerMeter: value })}
        />
      </div>
    </div>
  )
}

const selectClass =
  'w-full rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-amber-400/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-amber-400/15'

export function ControlCenter() {
  const {
    project,
    activeLayoutId,
    activeBehaviorProfileId,
    activeRouteId,
    setActiveRoute,
    setActiveLayout,
    duplicateActiveLayout,
    selectedObjectId,
    setActiveBehaviorProfile,
    updateActiveLayout,
    updateSpawn,
    updateFieldObject,
    updateRouteMeta,
    updateBehaviorProfile,
    deleteFieldObject,
    addFieldObject,
    snapToGrid,
    setSnapToGrid,
  } = useProjectStore(
    useShallow((state) => ({
      project: state.project,
      activeLayoutId: state.activeLayoutId,
      activeBehaviorProfileId: state.activeBehaviorProfileId,
      activeRouteId: state.activeRouteId,
      setActiveRoute: state.setActiveRoute,
      setActiveLayout: state.setActiveLayout,
      duplicateActiveLayout: state.duplicateActiveLayout,
      selectedObjectId: state.selectedObjectId,
      setActiveBehaviorProfile: state.setActiveBehaviorProfile,
      updateActiveLayout: state.updateActiveLayout,
      updateSpawn: state.updateSpawn,
      updateFieldObject: state.updateFieldObject,
      updateRouteMeta: state.updateRouteMeta,
      updateBehaviorProfile: state.updateBehaviorProfile,
      deleteFieldObject: state.deleteFieldObject,
      addFieldObject: state.addFieldObject,
      snapToGrid: state.snapToGrid,
      setSnapToGrid: state.setSnapToGrid,
    })),
  )

  const activeRoute = getActiveRoute(project, activeRouteId)
  const activeLayout = getActiveLayout(project, activeLayoutId)
  const selectedObject = findFieldObject(activeLayout, selectedObjectId)
  const profile = getActiveBehaviorProfile(project, activeBehaviorProfileId)

  return (
    <section className="grid gap-8">
      <PanelSection
        title="Control Center"
        subtitle="Route setup, field editing, and simulation tuning. This drawer stays out of the viewport’s way."
        collapsible
        defaultOpen={false}
      >
        <div className="grid gap-8">
          <div className="grid gap-5">
            <div className="flex items-center justify-between gap-4">
              <strong className="text-sm font-semibold text-stone-100">Route + Course</strong>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-white"
                onClick={duplicateActiveLayout}
              >
                Duplicate Layout
              </button>
            </div>

            <TextField
              label="Route name"
              value={activeRoute.name}
              onChange={(value) => updateRouteMeta({ name: value })}
            />

            <label className="grid gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Active route</span>
              <select className={selectClass} value={activeRouteId} onChange={(event) => setActiveRoute(event.target.value)}>
                {project.routeVersions.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </label>

            <TextAreaField
              label="Route summary"
              value={activeRoute.description}
              onChange={(value) => updateRouteMeta({ description: value })}
            />

            <label className="grid gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Input timing resolution</span>
              <select
                className={selectClass}
                value={String(activeRoute.timingResolution)}
                onChange={(event) => updateRouteMeta({ timingResolution: Number(event.target.value) })}
              >
                <option value="0.3">Fine stack (0.3 s)</option>
                <option value="1">Standard review (1.0 s)</option>
                <option value="3">Deep sweep (3.0 s)</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Active layout</span>
              <select className={selectClass} value={activeLayoutId} onChange={(event) => setActiveLayout(event.target.value)}>
                {project.fieldLayouts.map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Mission checkpoints</span>
              <div className="grid gap-2">
                {activeLayout.missionCheckpoints.map((checkpoint) => (
                  <div key={checkpoint.id} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                    <span>{checkpoint.order}. {checkpoint.label}</span>
                    <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${checkpoint.required ? 'text-amber-200' : 'text-slate-500'}`}>
                      {checkpoint.required ? checkpoint.passCondition : 'optional'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <NumberField
                label="Spawn X"
                value={activeLayout.spawn.position.x}
                onChange={(value) => updateSpawn({ position: { ...activeLayout.spawn.position, x: value } })}
              />
              <NumberField
                label="Spawn Z"
                value={activeLayout.spawn.position.z}
                onChange={(value) => updateSpawn({ position: { ...activeLayout.spawn.position, z: value } })}
              />
              <NumberField
                label="Spawn Y"
                value={activeLayout.spawn.position.y}
                onChange={(value) => updateSpawn({ position: { ...activeLayout.spawn.position, y: value } })}
              />
              <NumberField
                label="Heading"
                value={activeLayout.spawn.heading}
                onChange={(value) => updateSpawn({ heading: value })}
              />
            </div>
          </div>

          <div className="grid gap-5 border-t border-white/8 pt-6">
            <div className="grid gap-1">
              <strong className="text-sm font-semibold text-stone-100">Field Builder</strong>
              <span className="text-sm leading-6 text-slate-500">
                Double-click an object in the viewport, then drag on the grid or use the transform gizmo.
              </span>
            </div>

            <label className="flex items-center justify-between gap-4 border-b border-white/8 py-2">
              <span className="text-sm text-slate-400">Snap to grid</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-400"
                checked={snapToGrid}
                onChange={(event) => setSnapToGrid(event.target.checked)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              {FIELD_BUTTONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
                  onClick={() => addFieldObject(item.type)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {selectedObject ? (
              <div className="grid gap-4 border-t border-white/8 pt-4">
                <div className="flex items-center justify-between gap-4">
                  <strong className="text-sm font-semibold text-stone-100">Selected field object</strong>
                  <button
                    type="button"
                    className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-300 transition hover:text-rose-200"
                    onClick={() => deleteFieldObject(selectedObject.id)}
                  >
                    Delete
                  </button>
                </div>

                <TextField
                  label="Object name"
                  value={selectedObject.name}
                  onChange={(value) => updateFieldObject(selectedObject.id, { name: value })}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <NumberField
                    label="Pos X"
                    value={selectedObject.position.x}
                    onChange={(value) =>
                      updateFieldObject(selectedObject.id, { position: { ...selectedObject.position, x: value } })
                    }
                  />
                  <NumberField
                    label="Pos Z"
                    value={selectedObject.position.z}
                    onChange={(value) =>
                      updateFieldObject(selectedObject.id, { position: { ...selectedObject.position, z: value } })
                    }
                  />
                  <NumberField
                    label="Pos Y"
                    value={selectedObject.position.y}
                    onChange={(value) =>
                      updateFieldObject(selectedObject.id, { position: { ...selectedObject.position, y: value } })
                    }
                  />
                  <NumberField
                    label="Yaw"
                    value={selectedObject.rotation.y}
                    onChange={(value) =>
                      updateFieldObject(selectedObject.id, { rotation: { ...selectedObject.rotation, y: value } })
                    }
                  />
                  <NumberField
                    label="Width"
                    value={selectedObject.size.x}
                    onChange={(value) =>
                      updateFieldObject(selectedObject.id, { size: { ...selectedObject.size, x: value } })
                    }
                  />
                  <NumberField
                    label="Height"
                    value={selectedObject.size.y}
                    onChange={(value) =>
                      updateFieldObject(selectedObject.id, { size: { ...selectedObject.size, y: value } })
                    }
                  />
                  <NumberField
                    label="Depth"
                    value={selectedObject.size.z}
                    onChange={(value) =>
                      updateFieldObject(selectedObject.id, { size: { ...selectedObject.size, z: value } })
                    }
                  />
                  {CHECKPOINT_TYPES.has(selectedObject.type) ? (
                    <NumberField
                      label="Legacy checkpoint order"
                      value={selectedObject.checkpointOrder ?? 0}
                      onChange={(value) =>
                        updateFieldObject(selectedObject.id, {
                          checkpointOrder: value > 0 ? Math.round(value) : null,
                        })
                      }
                    />
                  ) : null}
                  {selectedObject.type === 'colorMat' ? (
                    <TextField
                      label="Mat color"
                      value={selectedObject.colorTag ?? 'blue'}
                      onChange={(value) =>
                        updateFieldObject(selectedObject.id, {
                          colorTag: value as FieldObject['colorTag'],
                        })
                      }
                    />
                  ) : null}
                  {selectedObject.type === 'colorMat' ? (
                    <NumberField
                      label="Detection delay ms"
                      value={selectedObject.detectionDelayMs ?? 0}
                      onChange={(value) =>
                        updateFieldObject(selectedObject.id, { detectionDelayMs: value })
                      }
                    />
                  ) : null}
                </div>

                {!selectedObject.isSolid ? (
                  <label className="flex items-center justify-between gap-4 border-b border-white/8 py-2">
                    <span className="text-sm text-slate-400">Wind reactive</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-amber-400"
                      checked={selectedObject.windResponsive ?? false}
                      onChange={(event) =>
                        updateFieldObject(selectedObject.id, { windResponsive: event.target.checked })
                      }
                    />
                  </label>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Select a field object to adjust placement, yaw, size, and checkpoint order.
              </p>
            )}
          </div>

          <div className="grid gap-5 border-t border-white/8 pt-6">
            <div className="grid gap-1">
              <strong className="text-sm font-semibold text-stone-100">Simulation Conditions</strong>
              <span className="text-sm leading-6 text-slate-500">
                Tune drift, overshoot, response delay, and environment variance.
              </span>
            </div>

            <label className="grid gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Condition preset</span>
              <select
                className={selectClass}
                value={activeBehaviorProfileId}
                onChange={(event) => setActiveBehaviorProfile(event.target.value)}
              >
                {project.behaviorProfiles.map((behaviorProfile) => (
                  <option key={behaviorProfile.id} value={behaviorProfile.id}>
                    {behaviorProfile.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              {project.behaviorProfiles.map((behaviorProfile) => (
                <button
                  key={behaviorProfile.id}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                    behaviorProfile.id === activeBehaviorProfileId
                      ? 'border-amber-300/40 bg-amber-300/12 text-amber-200'
                      : 'border-white/8 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-white'
                  }`}
                  onClick={() => setActiveBehaviorProfile(behaviorProfile.id)}
                >
                  {behaviorProfile.name}
                </button>
              ))}
            </div>

            <SimulationFields profile={profile} onChange={(patch) => updateBehaviorProfile(patch)} />

            <TextAreaField
              label="Layout notes"
              value={activeLayout.notes}
              onChange={(value) => updateActiveLayout({ notes: value })}
            />
          </div>
        </div>
      </PanelSection>
    </section>
  )
}
