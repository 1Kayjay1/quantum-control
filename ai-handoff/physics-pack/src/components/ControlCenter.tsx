import { useShallow } from 'zustand/react/shallow'

import type { BehaviorProfile, FieldObjectType } from '../core/types'
import {
  findFieldObject,
  getActiveBehaviorProfile,
  getActiveLayout,
  getActiveRoute,
} from '../core/selectors'
import { useProjectStore } from '../store/projectStore'
import { PanelSection } from './PanelSection'

const FIELD_BUTTONS: Array<{
  label: string
  type: FieldObjectType
}> = [
  { label: 'Wall', type: 'wall' },
  { label: 'Gate', type: 'gate' },
  { label: 'Ring', type: 'ring' },
  { label: 'Landing Zone', type: 'landingZone' },
  { label: 'Scoring Zone', type: 'scoringZone' },
  { label: 'Marker', type: 'marker' },
]

const CHECKPOINT_TYPES = new Set(['gate', 'ring', 'landingZone', 'scoringZone'])

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="slider-field">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <strong>{display ?? value}</strong>
      </div>
    </label>
  )
}

function SimulationFields({
  profile,
  onChange,
}: {
  profile: BehaviorProfile
  onChange: (patch: Partial<BehaviorProfile>) => void
}) {
  return (
    <div className="field-grid">
      <TextField
        label="Condition preset"
        value={profile.name}
        onChange={(value) => onChange({ name: value })}
      />
      <div className="field-grid field-grid--double">
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
      <label className="toggle-row">
        <span>Randomize each sim run</span>
        <input
          type="checkbox"
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
      <div className="field-grid field-grid--double">
        <NumberField
          label="Turn response"
          step={0.01}
          value={profile.turnResponsePct}
          onChange={(value) => onChange({ turnResponsePct: value })}
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
    <section className="panel panel--control-center">
      <PanelSection
        title="Control Center"
        subtitle="Route setup, field editing, and simulation tuning live here."
        collapsible
        defaultOpen={false}
      >
        <div className="control-center__group">
          <div className="control-center__header">
            <strong>Route + Course</strong>
            <button
              type="button"
              className="button button--ghost button--small"
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
          <label className="field">
            <span>Active route</span>
            <select value={activeRouteId} onChange={(event) => setActiveRoute(event.target.value)}>
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
          <label className="field">
            <span>Input timing resolution</span>
            <select
              value={String(activeRoute.timingResolution)}
              onChange={(event) =>
                updateRouteMeta({ timingResolution: Number(event.target.value) })
              }
            >
              <option value="0.3">Fine stack (0.3 s)</option>
              <option value="1">Standard review (1.0 s)</option>
              <option value="3">Deep sweep (3.0 s)</option>
            </select>
          </label>
          <label className="field">
            <span>Active layout</span>
            <select value={activeLayoutId} onChange={(event) => setActiveLayout(event.target.value)}>
              {project.fieldLayouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-grid field-grid--double">
            <NumberField
              label="Spawn X"
              value={activeLayout.spawn.position.x}
              onChange={(value) =>
                updateSpawn({
                  position: {
                    ...activeLayout.spawn.position,
                    x: value,
                  },
                })
              }
            />
            <NumberField
              label="Spawn Z"
              value={activeLayout.spawn.position.z}
              onChange={(value) =>
                updateSpawn({
                  position: {
                    ...activeLayout.spawn.position,
                    z: value,
                  },
                })
              }
            />
            <NumberField
              label="Spawn Y"
              value={activeLayout.spawn.position.y}
              onChange={(value) =>
                updateSpawn({
                  position: {
                    ...activeLayout.spawn.position,
                    y: value,
                  },
                })
              }
            />
            <NumberField
              label="Heading"
              value={activeLayout.spawn.heading}
              onChange={(value) => updateSpawn({ heading: value })}
            />
          </div>
        </div>

        <div className="control-center__group">
          <div className="control-center__header">
            <strong>Field Builder</strong>
            <span className="muted-copy">Double-click an object in the viewport, then drag on the grid.</span>
          </div>

          <label className="toggle-row">
            <span>Snap to grid</span>
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(event) => setSnapToGrid(event.target.checked)}
            />
          </label>

          <div className="builder-grid">
            {FIELD_BUTTONS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="builder-button"
                onClick={() => addFieldObject(item.type)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {selectedObject ? (
            <div className="object-editor">
              <div className="object-editor__header">
                <strong>Selected field object</strong>
                <button
                  type="button"
                  className="button button--ghost button--small"
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

              <div className="field-grid field-grid--double">
                <NumberField
                  label="Pos X"
                  value={selectedObject.position.x}
                  onChange={(value) =>
                    updateFieldObject(selectedObject.id, {
                      position: {
                        ...selectedObject.position,
                        x: value,
                      },
                    })
                  }
                />
                <NumberField
                  label="Pos Z"
                  value={selectedObject.position.z}
                  onChange={(value) =>
                    updateFieldObject(selectedObject.id, {
                      position: {
                        ...selectedObject.position,
                        z: value,
                      },
                    })
                  }
                />
                <NumberField
                  label="Pos Y"
                  value={selectedObject.position.y}
                  onChange={(value) =>
                    updateFieldObject(selectedObject.id, {
                      position: {
                        ...selectedObject.position,
                        y: value,
                      },
                    })
                  }
                />
                <NumberField
                  label="Yaw"
                  value={selectedObject.rotation.y}
                  onChange={(value) =>
                    updateFieldObject(selectedObject.id, {
                      rotation: {
                        ...selectedObject.rotation,
                        y: value,
                      },
                    })
                  }
                />
                <NumberField
                  label="Width"
                  value={selectedObject.size.x}
                  onChange={(value) =>
                    updateFieldObject(selectedObject.id, {
                      size: {
                        ...selectedObject.size,
                        x: value,
                      },
                    })
                  }
                />
                <NumberField
                  label="Height"
                  value={selectedObject.size.y}
                  onChange={(value) =>
                    updateFieldObject(selectedObject.id, {
                      size: {
                        ...selectedObject.size,
                        y: value,
                      },
                    })
                  }
                />
                <NumberField
                  label="Depth"
                  value={selectedObject.size.z}
                  onChange={(value) =>
                    updateFieldObject(selectedObject.id, {
                      size: {
                        ...selectedObject.size,
                        z: value,
                      },
                    })
                  }
                />
              {CHECKPOINT_TYPES.has(selectedObject.type) ? (
                <NumberField
                  label="Checkpoint order"
                  value={selectedObject.checkpointOrder ?? 0}
                  onChange={(value) =>
                      updateFieldObject(selectedObject.id, {
                        checkpointOrder: value > 0 ? Math.round(value) : null,
                      })
                    }
                />
              ) : null}
            </div>

              {!selectedObject.isSolid ? (
                <label className="toggle-row">
                  <span>Wind reactive</span>
                  <input
                    type="checkbox"
                    checked={selectedObject.windResponsive ?? false}
                    onChange={(event) =>
                      updateFieldObject(selectedObject.id, {
                        windResponsive: event.target.checked,
                      })
                    }
                  />
                </label>
              ) : null}
            </div>
          ) : (
            <p className="muted-copy">
              Select a field object to adjust its placement, yaw, size, and checkpoint order.
            </p>
          )}
        </div>

        <div className="control-center__group">
          <div className="control-center__header">
            <strong>Simulation Conditions</strong>
          </div>

          <label className="field">
            <span>Condition preset</span>
            <select
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

          <div className="preset-chip-row" role="group" aria-label="Condition presets">
            {project.behaviorProfiles.map((behaviorProfile) => (
              <button
                key={behaviorProfile.id}
                type="button"
                className={`preset-chip${behaviorProfile.id === activeBehaviorProfileId ? ' preset-chip--active' : ''}`}
                onClick={() => setActiveBehaviorProfile(behaviorProfile.id)}
              >
                {behaviorProfile.name}
              </button>
            ))}
          </div>

          <SimulationFields
            profile={profile}
            onChange={(patch) => updateBehaviorProfile(patch)}
          />

          <TextAreaField
            label="Layout notes"
            value={activeLayout.notes}
            onChange={(value) => updateActiveLayout({ notes: value })}
          />
        </div>
      </PanelSection>
    </section>
  )
}
