import { create } from 'zustand'

import { GRID_SIZE_CM, MAX_HISTORY_ENTRIES, MONTE_CARLO_RUNS } from '../core/constants'
import { formatManualSheet, manualSheetToText } from '../core/export/manualSheet'
import { createId } from '../core/id'
import { invertInstructionKind } from '../core/instructions'
import { clamp, roundToGrid } from '../core/math'
import { createFieldObject, createInstructionBlock, createMissionCheckpoint, INSTRUCTION_LIBRARY } from '../core/presets'
import { getActiveBehaviorProfile, getActiveLayout, getActiveRoute, getCompareRoute } from '../core/selectors'
import { createStarterProject } from '../core/sampleProject'
import { compileInstructionSequence } from '../core/simulation/compile'
import { compareRuns } from '../core/simulation/analysis'
import { runDeepAnalysis, simulateRoute } from '../core/simulation/simulate'
import { getStoredProject, listStoredProjects, saveStoredProject } from '../core/storage/db'
import type {
  BehaviorProfile,
  ComparisonSnapshot,
  DeepAnalysisResult,
  FieldObject,
  FieldObjectType,
  InstructionBlock,
  InstructionKind,
  PlaybackState,
  Project,
  ProjectSummary,
  RouteVersion,
  SimulationMode,
  SimulationPipelineStage,
  SimulationRun,
  TimelineDockState,
  WorkspaceMode,
  MissionCheckpoint,
} from '../core/types'

const MISSION_OBJECT_DEFAULTS: Partial<
  Record<
    FieldObjectType,
    {
      checkpointType: MissionCheckpoint['checkpointType']
      passCondition: MissionCheckpoint['passCondition']
      required: boolean
    }
  >
> = {
  archGate: { checkpointType: 'archGate', passCondition: 'flyUnder', required: true },
  keyholeGate: { checkpointType: 'keyholeGate', passCondition: 'flyThrough', required: true },
  tunnel: { checkpointType: 'tunnel', passCondition: 'flyThrough', required: true },
  flyThroughPanel: { checkpointType: 'flyThroughPanel', passCondition: 'flyThrough', required: true },
  colorMat: { checkpointType: 'colorMat', passCondition: 'detectColor', required: true },
  landingPad: { checkpointType: 'landingPad', passCondition: 'landOn', required: true },
  miniArchGate: { checkpointType: 'miniArchGate', passCondition: 'flyThrough', required: false },
  landingZone: { checkpointType: 'custom', passCondition: 'landOn', required: true },
  scoringZone: { checkpointType: 'custom', passCondition: 'flyIntoZone', required: true },
  gate: { checkpointType: 'custom', passCondition: 'flyThrough', required: true },
  ring: { checkpointType: 'custom', passCondition: 'flyThrough', required: true },
}

function syncMissionCheckpointForObject(
  layout: Project['fieldLayouts'][number],
  object: FieldObject,
): void {
  const missionConfig = MISSION_OBJECT_DEFAULTS[object.type]
  const existingIndex = layout.missionCheckpoints.findIndex((checkpoint) => checkpoint.objectId === object.id)

  if (!missionConfig) {
    if (existingIndex >= 0) {
      layout.missionCheckpoints.splice(existingIndex, 1)
    }
    return
  }

  const existing = existingIndex >= 0 ? layout.missionCheckpoints[existingIndex] : null
  const inferredOrder =
    object.checkpointOrder ??
    existing?.order ??
    layout.missionCheckpoints.filter((checkpoint) => checkpoint.required).length + 1

  const checkpoint =
    existing ??
    createMissionCheckpoint(object, {
      order: inferredOrder,
      checkpointType: missionConfig.checkpointType,
      passCondition: missionConfig.passCondition,
      required: missionConfig.required,
    })

  checkpoint.label = checkpoint.label || object.name
  checkpoint.objectId = object.id
  checkpoint.order = inferredOrder
  checkpoint.checkpointType = missionConfig.checkpointType
  checkpoint.passCondition = missionConfig.passCondition
  checkpoint.required = missionConfig.required

  if (existingIndex >= 0) {
    layout.missionCheckpoints[existingIndex] = checkpoint
  } else {
    layout.missionCheckpoints.push(checkpoint)
  }

  layout.missionCheckpoints.sort((left, right) => left.order - right.order)
}

interface EditorSnapshot {
  project: Project
  activeLayoutId: string
  activeRouteId: string
  compareRouteId: string | null
  activeBehaviorProfileId: string
  selectedObjectId: string | null
  selectedInstructionId: string | null
  snapToGrid: boolean
}

interface ProjectStoreState extends EditorSnapshot {
  hydrated: boolean
  projectSummaries: ProjectSummary[]
  run: SimulationRun | null
  comparisonRun: SimulationRun | null
  comparison: ComparisonSnapshot | null
  playbackTime: number
  playbackState: PlaybackState
  playbackSpeed: number
  workspaceMode: WorkspaceMode
  timelineDockState: TimelineDockState
  physicsDebugEnabled: boolean
  seed: number
  monteCarloRuns: number
  simulationMode: SimulationMode
  simulationPipeline: SimulationPipelineStage[]
  deepAnalysis: DeepAnalysisResult | null
  isSolving: boolean
  lastSavedAt: string | null
  exportSheetText: string
  statusMessage: string | null
  past: EditorSnapshot[]
  future: EditorSnapshot[]
  bootstrap: () => Promise<void>
  saveProject: () => Promise<void>
  loadProject: (projectId: string) => Promise<void>
  importProjectFromJson: (json: string) => Promise<void>
  exportProjectJson: () => string
  setProjectName: (name: string) => void
  setActiveLayout: (layoutId: string) => void
  duplicateActiveLayout: () => void
  updateActiveLayout: (patch: Partial<Project['fieldLayouts'][number]>) => void
  setActiveRoute: (routeId: string) => void
  setCompareRoute: (routeId: string | null) => void
  duplicateRouteVersion: () => void
  updateRouteMeta: (patch: Partial<RouteVersion>) => void
  addFieldObject: (type: FieldObjectType) => void
  updateFieldObject: (objectId: string, patch: Partial<FieldObject>) => void
  deleteFieldObject: (objectId: string) => void
  updateSpawn: (patch: Partial<Project['fieldLayouts'][number]['spawn']>) => void
  selectObject: (objectId: string | null) => void
  selectInstruction: (instructionId: string | null) => void
  addInstruction: (kind: InstructionKind) => void
  updateInstruction: (instructionId: string, patch: Partial<InstructionBlock>) => void
  applyInstructionPatches: (
    patches: Array<{ instructionId: string; patch: Partial<InstructionBlock> }>,
  ) => void
  moveInstruction: (instructionId: string, direction: -1 | 1) => void
  duplicateInstruction: (instructionId: string) => void
  invertInstruction: (instructionId: string) => void
  deleteInstruction: (instructionId: string) => void
  setActiveBehaviorProfile: (profileId: string) => void
  duplicateBehaviorProfile: () => void
  updateBehaviorProfile: (patch: Partial<BehaviorProfile>) => void
  setSnapToGrid: (enabled: boolean) => void
  setPlaybackTime: (time: number) => void
  setPlaybackState: (state: PlaybackState) => void
  setPlaybackSpeed: (speed: number) => void
  setWorkspaceMode: (mode: WorkspaceMode) => void
  setTimelineDockState: (state: TimelineDockState) => void
  setPhysicsDebugEnabled: (enabled: boolean) => void
  jumpToInstruction: (instructionId: string) => void
  resetPlayback: () => void
  setSeed: (seed: number) => void
  setSimulationMode: (mode: SimulationMode) => void
  setMonteCarloRuns: (count: number) => void
  runQuickSimulation: () => Promise<void>
  runDeepAnalysis: () => Promise<void>
  undo: () => void
  redo: () => void
  clearStatus: () => void
}

function cloneSnapshot(state: EditorSnapshot): EditorSnapshot {
  return structuredClone(state)
}

function buildSnapshot(state: ProjectStoreState): EditorSnapshot {
  return {
    project: structuredClone(state.project),
    activeLayoutId: state.activeLayoutId,
    activeRouteId: state.activeRouteId,
    compareRouteId: state.compareRouteId,
    activeBehaviorProfileId: state.activeBehaviorProfileId,
    selectedObjectId: state.selectedObjectId,
    selectedInstructionId: state.selectedInstructionId,
    snapToGrid: state.snapToGrid,
  }
}

function withMutation(
  set: (partial: Partial<ProjectStoreState> | ((state: ProjectStoreState) => Partial<ProjectStoreState>)) => void,
  get: () => ProjectStoreState,
  mutator: (draft: EditorSnapshot) => void,
): void {
  const state = get()
  const draft = buildSnapshot(state)
  mutator(draft)
  draft.project.updatedAt = new Date().toISOString()

  set((current) => ({
    ...draft,
    past: [...current.past, buildSnapshot(current)].slice(-MAX_HISTORY_ENTRIES),
    future: [],
    run: null,
    comparisonRun: null,
    comparison: null,
    deepAnalysis: null,
    playbackTime: 0,
    playbackState: 'idle',
    simulationPipeline: buildPipeline(),
    exportSheetText: manualSheetToText(
      formatManualSheet(getActiveRoute(draft.project, draft.activeRouteId), null),
    ),
  }))
}

function cloneRoute(route: RouteVersion): RouteVersion {
  return {
    ...structuredClone(route),
    id: createId('route'),
    name: `${route.name} Copy`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    instructions: route.instructions.map((instruction) => ({
      ...instruction,
      id: createId('instruction'),
    })),
  }
}

function cloneBehaviorProfile(profile: BehaviorProfile): BehaviorProfile {
  return {
    ...structuredClone(profile),
    id: createId('profile'),
    name: `${profile.name} Copy`,
  }
}

function getInstructionLibraryLabel(kind: InstructionKind): string {
  return INSTRUCTION_LIBRARY.find((item) => item.kind === kind)?.label ?? kind
}

function normalizeProject(project: Project): Project {
  const normalizedBehaviorProfiles = project.behaviorProfiles.map((profile) => ({
    ...profile,
    massKg: profile.massKg ?? 0.0584,
    hoverAssistPct: profile.hoverAssistPct ?? 1,
    hoverBrakeAssistPct: profile.hoverBrakeAssistPct ?? 0.56,
    altitudeHoldGain: profile.altitudeHoldGain ?? 5.8,
    attitudeHoldGain: profile.attitudeHoldGain ?? 1,
    carryPct: profile.carryPct ?? 0.36,
    coastDurationMs: profile.coastDurationMs ?? 420,
    referenceAssistDuringCoastPct: profile.referenceAssistDuringCoastPct ?? 0.24,
    randomizeConditions: profile.randomizeConditions ?? false,
    randomizationPct: profile.randomizationPct ?? 0.1,
    gustStrengthCmS2: profile.gustStrengthCmS2 ?? 12,
    propWashStrength: profile.propWashStrength ?? 0.42,
    objectDraftStrength: profile.objectDraftStrength ?? 0.24,
  }))
  const existingProfileNames = new Set(normalizedBehaviorProfiles.map((profile) => profile.name))
  const missingProfiles = createStarterProject().behaviorProfiles
    .filter((profile) => !existingProfileNames.has(profile.name))
    .map((profile) => structuredClone(profile))

  return {
    ...project,
    fieldLayouts: project.fieldLayouts.map((layout) => ({
      ...layout,
      objects: layout.objects.map((object) => ({
        ...object,
        checkpointOrder: object.checkpointOrder ?? null,
        isSolid: object.isSolid ?? (object.type === 'wall' || object.type === 'boundary'),
        windResponsive: object.windResponsive ?? object.type === 'marker',
      })),
      missionCheckpoints:
        layout.missionCheckpoints?.map((checkpoint) => ({
          ...checkpoint,
          completed: checkpoint.completed ?? false,
          completedTime: checkpoint.completedTime ?? null,
          invalidated: checkpoint.invalidated ?? false,
          required: checkpoint.required ?? true,
          note: checkpoint.note ?? '',
        })) ??
        layout.objects
          .filter((object) => (object.checkpointOrder ?? 0) > 0)
          .sort((a, b) => (a.checkpointOrder ?? 0) - (b.checkpointOrder ?? 0))
          .map((object): MissionCheckpoint =>
            createMissionCheckpoint(object, {
              order: object.checkpointOrder ?? 0,
              passCondition:
                object.type === 'landingZone'
                  ? 'landOn'
                  : object.type === 'scoringZone'
                    ? 'flyIntoZone'
                    : 'flyThrough',
              required: true,
            }),
          ),
    })),
    routeVersions: project.routeVersions.map((route) => ({
      ...route,
      timingResolution: route.timingResolution ?? 0.3,
      instructions: route.instructions.map((instruction) => ({
        ...instruction,
        strength:
          instruction.strength ??
          clamp(
            Math.round(
              instruction.kind === 'rotateCW' || instruction.kind === 'rotateCCW'
                ? ((instruction.speed || 110) / 185) * 100
                : ((instruction.speed || 70) / 135) * 100,
            ),
            0,
            100,
          ),
        stackNextBy: instruction.stackNextBy ?? 0,
        timelineLane: instruction.timelineLane ?? 0,
      })),
    })),
    behaviorProfiles: [...normalizedBehaviorProfiles, ...missingProfiles],
  }
}

function updateSheetText(state: ProjectStoreState, run: SimulationRun | null): string {
  return manualSheetToText(
    formatManualSheet(getActiveRoute(state.project, state.activeRouteId), run),
  )
}

const PIPELINE_TEMPLATE: SimulationPipelineStage[] = [
  { id: 'compile', label: 'Compiling route', status: 'pending' },
  { id: 'runtime', label: 'Building runtime windows', status: 'pending' },
  { id: 'planned', label: 'Running planned pass', status: 'pending' },
  { id: 'actual', label: 'Running actual pass', status: 'pending' },
  { id: 'checks', label: 'Checking checkpoints and collisions', status: 'pending' },
  { id: 'metrics', label: 'Computing metrics', status: 'pending' },
  { id: 'confidence', label: 'Running confidence estimate', status: 'pending' },
  { id: 'replay', label: 'Preparing replay', status: 'pending' },
]

function buildPipeline(): SimulationPipelineStage[] {
  return PIPELINE_TEMPLATE.map((stage) => ({ ...stage }))
}

const starterProject = createStarterProject()
const starterState: EditorSnapshot = {
  project: starterProject,
  activeLayoutId: starterProject.fieldLayouts[0].id,
  activeRouteId: starterProject.routeVersions[0].id,
  compareRouteId: starterProject.routeVersions[1]?.id ?? null,
  activeBehaviorProfileId: starterProject.behaviorProfiles[0].id,
  selectedObjectId: starterProject.fieldLayouts[0].objects[0]?.id ?? null,
  selectedInstructionId: starterProject.routeVersions[0].instructions[0]?.id ?? null,
  snapToGrid: true,
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  ...starterState,
  hydrated: false,
  projectSummaries: [],
  run: null,
  comparisonRun: null,
  comparison: null,
  playbackTime: 0,
  playbackState: 'idle',
  playbackSpeed: 1,
  workspaceMode: 'editor',
  timelineDockState: 'edit',
  physicsDebugEnabled: false,
  seed: 7,
  monteCarloRuns: MONTE_CARLO_RUNS,
  simulationMode: 'quick',
  simulationPipeline: buildPipeline(),
  deepAnalysis: null,
  isSolving: false,
  lastSavedAt: null,
  exportSheetText: manualSheetToText(
    formatManualSheet(getActiveRoute(starterProject, starterState.activeRouteId), null),
  ),
  statusMessage: null,
  past: [],
  future: [],

  bootstrap: async () => {
    try {
      const projectSummaries = await listStoredProjects()

      if (projectSummaries.length === 0) {
        const project = normalizeProject(createStarterProject())
        await saveStoredProject(project)
        set({
          project,
          activeLayoutId: project.fieldLayouts[0].id,
          activeRouteId: project.routeVersions[0].id,
          compareRouteId: project.routeVersions[1]?.id ?? null,
          activeBehaviorProfileId: project.behaviorProfiles[0].id,
          selectedObjectId: project.fieldLayouts[0].objects[0]?.id ?? null,
          selectedInstructionId: project.routeVersions[0].instructions[0]?.id ?? null,
          projectSummaries: await listStoredProjects(),
          hydrated: true,
          exportSheetText: manualSheetToText(
            formatManualSheet(project.routeVersions[0], null),
          ),
        })
        return
      }

      const latestProject = await getStoredProject(projectSummaries[0].id)
      if (!latestProject) {
        throw new Error('No stored project could be loaded.')
      }
      const normalizedProject = normalizeProject(latestProject)

      set({
        project: normalizedProject,
        activeLayoutId: normalizedProject.fieldLayouts[0].id,
        activeRouteId: normalizedProject.routeVersions[0].id,
        compareRouteId: normalizedProject.routeVersions[1]?.id ?? null,
        activeBehaviorProfileId: normalizedProject.behaviorProfiles[0].id,
        selectedObjectId: normalizedProject.fieldLayouts[0].objects[0]?.id ?? null,
        selectedInstructionId: normalizedProject.routeVersions[0].instructions[0]?.id ?? null,
        projectSummaries,
        hydrated: true,
        exportSheetText: manualSheetToText(
          formatManualSheet(normalizedProject.routeVersions[0], null),
        ),
      })
    } catch {
      const fallbackProject = normalizeProject(createStarterProject())
      set({
        project: fallbackProject,
        activeLayoutId: fallbackProject.fieldLayouts[0].id,
        activeRouteId: fallbackProject.routeVersions[0].id,
        compareRouteId: fallbackProject.routeVersions[1]?.id ?? null,
        activeBehaviorProfileId: fallbackProject.behaviorProfiles[0].id,
        selectedObjectId: fallbackProject.fieldLayouts[0].objects[0]?.id ?? null,
        selectedInstructionId: fallbackProject.routeVersions[0].instructions[0]?.id ?? null,
        projectSummaries: [],
        hydrated: true,
        exportSheetText: manualSheetToText(
          formatManualSheet(fallbackProject.routeVersions[0], null),
        ),
        statusMessage:
          'Local storage was unavailable. Loaded a temporary in-memory project instead.',
      })
    }
  },

  saveProject: async () => {
    const state = get()
    try {
      await saveStoredProject(state.project)
      set({
        projectSummaries: await listStoredProjects(),
        lastSavedAt: new Date().toISOString(),
        statusMessage: 'Project saved locally.',
      })
    } catch {
      set({
        statusMessage: 'Local save failed in this environment. Working in memory only.',
      })
    }
  },

  loadProject: async (projectId) => {
    const project = await getStoredProject(projectId)
    if (!project) {
      set({ statusMessage: 'Unable to load that project.' })
      return
    }
    const normalizedProject = normalizeProject(project)

    set({
      project: normalizedProject,
      activeLayoutId: normalizedProject.fieldLayouts[0].id,
      activeRouteId: normalizedProject.routeVersions[0].id,
      compareRouteId: normalizedProject.routeVersions[1]?.id ?? null,
      activeBehaviorProfileId: normalizedProject.behaviorProfiles[0].id,
      selectedObjectId: normalizedProject.fieldLayouts[0].objects[0]?.id ?? null,
      selectedInstructionId: normalizedProject.routeVersions[0].instructions[0]?.id ?? null,
      run: null,
      comparisonRun: null,
      comparison: null,
      deepAnalysis: null,
      playbackTime: 0,
      playbackState: 'idle',
      simulationPipeline: buildPipeline(),
      exportSheetText: manualSheetToText(
        formatManualSheet(normalizedProject.routeVersions[0], null),
      ),
      past: [],
      future: [],
      statusMessage: `Loaded ${normalizedProject.name}.`,
    })
  },

  importProjectFromJson: async (json) => {
    const parsed = normalizeProject(JSON.parse(json) as Project)
    parsed.id = parsed.id || createId('project')
    parsed.updatedAt = new Date().toISOString()
    await saveStoredProject(parsed)
    set({
      project: parsed,
      activeLayoutId: parsed.fieldLayouts[0].id,
      activeRouteId: parsed.routeVersions[0].id,
      compareRouteId: parsed.routeVersions[1]?.id ?? null,
      activeBehaviorProfileId: parsed.behaviorProfiles[0].id,
      selectedObjectId: parsed.fieldLayouts[0].objects[0]?.id ?? null,
      selectedInstructionId: parsed.routeVersions[0].instructions[0]?.id ?? null,
      projectSummaries: await listStoredProjects(),
      run: null,
      comparisonRun: null,
      comparison: null,
      deepAnalysis: null,
      playbackTime: 0,
      playbackState: 'idle',
      simulationPipeline: buildPipeline(),
      exportSheetText: manualSheetToText(
        formatManualSheet(parsed.routeVersions[0], null),
      ),
      past: [],
      future: [],
      statusMessage: `Imported ${parsed.name}.`,
    })
  },

  exportProjectJson: () => JSON.stringify(get().project, null, 2),

  setProjectName: (name) => {
    withMutation(set, get, (draft) => {
      draft.project.name = name
    })
  },

  setActiveLayout: (layoutId) => {
    set((state) => ({
      activeLayoutId: layoutId,
      selectedObjectId: getActiveLayout(state.project, layoutId).objects[0]?.id ?? null,
      run: null,
      comparisonRun: null,
      comparison: null,
      deepAnalysis: null,
      playbackTime: 0,
      playbackState: 'idle',
      simulationPipeline: buildPipeline(),
    }))
  },

  duplicateActiveLayout: () => {
    withMutation(set, get, (draft) => {
      const layout = getActiveLayout(draft.project, draft.activeLayoutId)
      const duplicated = structuredClone(layout)
      duplicated.id = createId('layout')
      duplicated.name = `${layout.name} Copy`
      draft.project.fieldLayouts.push(duplicated)
      draft.activeLayoutId = duplicated.id
      draft.selectedObjectId = duplicated.objects[0]?.id ?? null
    })
  },

  updateActiveLayout: (patch) => {
    withMutation(set, get, (draft) => {
      const layout = getActiveLayout(draft.project, draft.activeLayoutId)
      Object.assign(layout, patch)
    })
  },

  setActiveRoute: (routeId) => {
    set((state) => ({
      activeRouteId: routeId,
      selectedInstructionId: getActiveRoute(state.project, routeId).instructions[0]?.id ?? null,
      run: null,
      comparisonRun: null,
      comparison: null,
      deepAnalysis: null,
      playbackTime: 0,
      playbackState: 'idle',
      simulationPipeline: buildPipeline(),
      exportSheetText: manualSheetToText(
        formatManualSheet(getActiveRoute(state.project, routeId), null),
      ),
    }))
  },

  setCompareRoute: (routeId) => {
    set({
      compareRouteId: routeId,
      comparisonRun: null,
      comparison: null,
      deepAnalysis: null,
    })
  },

  duplicateRouteVersion: () => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      const duplicated = cloneRoute(route)
      draft.project.routeVersions.push(duplicated)
      draft.activeRouteId = duplicated.id
      draft.compareRouteId = route.id
      draft.selectedInstructionId = duplicated.instructions[0]?.id ?? null
    })
  },

  updateRouteMeta: (patch) => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      Object.assign(route, patch)
      route.updatedAt = new Date().toISOString()
    })
  },

  addFieldObject: (type) => {
    withMutation(set, get, (draft) => {
      const layout = getActiveLayout(draft.project, draft.activeLayoutId)
      const offset = (layout.objects.length % 6) * 40 - 80
      const object = createFieldObject(type, offset)
      if (draft.snapToGrid) {
        object.position.x = roundToGrid(object.position.x, GRID_SIZE_CM)
        object.position.z = roundToGrid(object.position.z, GRID_SIZE_CM)
      }
      layout.objects.push(object)
      syncMissionCheckpointForObject(layout, object)
      draft.selectedObjectId = object.id
    })
  },

  updateFieldObject: (objectId, patch) => {
    withMutation(set, get, (draft) => {
      const layout = getActiveLayout(draft.project, draft.activeLayoutId)
      const object = layout.objects.find((candidate) => candidate.id === objectId)
      if (!object) {
        return
      }

      Object.assign(object, patch)
      if (patch.position && draft.snapToGrid) {
        object.position.x = roundToGrid(patch.position.x, GRID_SIZE_CM)
        object.position.y = patch.position.y
        object.position.z = roundToGrid(patch.position.z, GRID_SIZE_CM)
      }
      if (typeof patch.checkpointOrder !== 'undefined') {
        syncMissionCheckpointForObject(layout, object)
      }
    })
  },

  deleteFieldObject: (objectId) => {
    withMutation(set, get, (draft) => {
      const layout = getActiveLayout(draft.project, draft.activeLayoutId)
      layout.objects = layout.objects.filter((object) => object.id !== objectId)
      layout.missionCheckpoints = layout.missionCheckpoints.filter((checkpoint) => checkpoint.objectId !== objectId)
      draft.selectedObjectId = layout.objects[0]?.id ?? null
    })
  },

  updateSpawn: (patch) => {
    withMutation(set, get, (draft) => {
      const layout = getActiveLayout(draft.project, draft.activeLayoutId)
      layout.spawn = {
        ...layout.spawn,
        ...patch,
        position: patch.position
          ? {
              x: draft.snapToGrid ? roundToGrid(patch.position.x, GRID_SIZE_CM) : patch.position.x,
              y: patch.position.y,
              z: draft.snapToGrid ? roundToGrid(patch.position.z, GRID_SIZE_CM) : patch.position.z,
            }
          : layout.spawn.position,
      }
    })
  },

  selectObject: (objectId) => {
    set({ selectedObjectId: objectId })
  },

  selectInstruction: (instructionId) => {
    set({ selectedInstructionId: instructionId })
  },

  addInstruction: (kind) => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      const instruction = createInstructionBlock(kind)
      route.instructions.push(instruction)
      route.updatedAt = new Date().toISOString()
      draft.selectedInstructionId = instruction.id
    })
  },

  updateInstruction: (instructionId, patch) => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      const instruction = route.instructions.find((candidate) => candidate.id === instructionId)
      if (!instruction) {
        return
      }

      Object.assign(instruction, patch)
      route.updatedAt = new Date().toISOString()
    })
  },

  applyInstructionPatches: (patches) => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      let didChange = false

      for (const { instructionId, patch } of patches) {
        const instruction = route.instructions.find((candidate) => candidate.id === instructionId)
        if (!instruction) {
          continue
        }

        Object.assign(instruction, patch)
        didChange = true
      }

      if (didChange) {
        route.updatedAt = new Date().toISOString()
      }
    })
  },

  moveInstruction: (instructionId, direction) => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      const index = route.instructions.findIndex((instruction) => instruction.id === instructionId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= route.instructions.length) {
        return
      }

      const [instruction] = route.instructions.splice(index, 1)
      route.instructions.splice(targetIndex, 0, instruction)
      route.updatedAt = new Date().toISOString()
    })
  },

  duplicateInstruction: (instructionId) => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      const index = route.instructions.findIndex((instruction) => instruction.id === instructionId)
      if (index < 0) {
        return
      }

      const duplicated = structuredClone(route.instructions[index])
      duplicated.id = createId('instruction')
      route.instructions.splice(index + 1, 0, duplicated)
      route.updatedAt = new Date().toISOString()
      draft.selectedInstructionId = duplicated.id
    })
  },

  invertInstruction: (instructionId) => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      const instruction = route.instructions.find((candidate) => candidate.id === instructionId)
      if (!instruction) {
        return
      }

      const invertedKind = invertInstructionKind(instruction.kind)
      if (!invertedKind) {
        return
      }

      instruction.kind = invertedKind
      instruction.label = getInstructionLibraryLabel(invertedKind)
      route.updatedAt = new Date().toISOString()
    })
  },

  deleteInstruction: (instructionId) => {
    withMutation(set, get, (draft) => {
      const route = getActiveRoute(draft.project, draft.activeRouteId)
      route.instructions = route.instructions.filter((instruction) => instruction.id !== instructionId)
      route.updatedAt = new Date().toISOString()
      draft.selectedInstructionId = route.instructions[0]?.id ?? null
    })
  },

  setActiveBehaviorProfile: (profileId) => {
    set({
      activeBehaviorProfileId: profileId,
      run: null,
      comparisonRun: null,
      comparison: null,
      deepAnalysis: null,
      simulationPipeline: buildPipeline(),
    })
  },

  duplicateBehaviorProfile: () => {
    withMutation(set, get, (draft) => {
      const profile = getActiveBehaviorProfile(draft.project, draft.activeBehaviorProfileId)
      const duplicated = cloneBehaviorProfile(profile)
      draft.project.behaviorProfiles.push(duplicated)
      draft.activeBehaviorProfileId = duplicated.id
    })
  },

  updateBehaviorProfile: (patch) => {
    withMutation(set, get, (draft) => {
      const profile = getActiveBehaviorProfile(draft.project, draft.activeBehaviorProfileId)
      Object.assign(profile, patch)
    })
  },

  setSnapToGrid: (enabled) => {
    set({ snapToGrid: enabled })
  },

  setPlaybackTime: (time) => {
    set((state) => ({
      playbackTime: Math.max(0, Math.min(time, state.run?.metrics.totalTime ?? 0)),
    }))
  },

  setPlaybackState: (playbackState) => {
    set({ playbackState })
  },

  setPlaybackSpeed: (playbackSpeed) => {
    set({ playbackSpeed })
  },

  setWorkspaceMode: (workspaceMode) => {
    set({ workspaceMode })
  },

  setTimelineDockState: (timelineDockState) => {
    set({ timelineDockState })
  },

  setPhysicsDebugEnabled: (physicsDebugEnabled) => {
    set({ physicsDebugEnabled })
  },

  jumpToInstruction: (instructionId) => {
    const run = get().run
    const segment = run?.segments.find((candidate) => candidate.instructionId === instructionId)
    if (!segment) {
      return
    }

    set({
      playbackTime: segment.startTime,
      playbackState: 'paused',
      selectedInstructionId: instructionId,
    })
  },

  resetPlayback: () => {
    set({
      playbackTime: 0,
      playbackState: 'idle',
    })
  },

  setSeed: (seed) => {
    set({ seed })
  },

  setSimulationMode: (simulationMode) => {
    set({ simulationMode })
  },

  setMonteCarloRuns: (monteCarloRuns) => {
    set({ monteCarloRuns })
  },

  runQuickSimulation: async () => {
    const advanceStage = async (activeStageId: SimulationPipelineStage['id']) => {
      set((state) => ({
        simulationPipeline: buildPipeline().map((stage) => {
          const order = PIPELINE_TEMPLATE.findIndex((candidate) => candidate.id === stage.id)
          const activeOrder = PIPELINE_TEMPLATE.findIndex((candidate) => candidate.id === activeStageId)
          if (stage.id === 'confidence') {
            return { ...stage, status: 'skipped' }
          }
          if (order < activeOrder) {
            return { ...stage, status: 'completed' }
          }
          if (stage.id === activeStageId) {
            return { ...stage, status: 'active' }
          }
          return state.simulationPipeline.find((candidate) => candidate.id === stage.id) ?? stage
        }),
      }))
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }

    const startedAt = performance.now()
    const state = get()
    const layout = getActiveLayout(state.project, state.activeLayoutId)
    const route = getActiveRoute(state.project, state.activeRouteId)
    const behaviorProfile = getActiveBehaviorProfile(state.project, state.activeBehaviorProfileId)
    const compareRoute = getCompareRoute(state.project, state.compareRouteId)

    set({
      isSolving: true,
      simulationMode: 'quick',
      deepAnalysis: null,
      simulationPipeline: buildPipeline(),
      statusMessage: 'Running quick simulation...',
    })

    await advanceStage('compile')
    const plannedSegments = compileInstructionSequence(route, layout.spawn)

    await advanceStage('runtime')
    await advanceStage('planned')
    await advanceStage('actual')
    const run = simulateRoute(plannedSegments, behaviorProfile, layout, state.seed)

    await advanceStage('checks')
    await advanceStage('metrics')
    let comparisonRun: SimulationRun | null = null
    let comparison: ComparisonSnapshot | null = null

    if (compareRoute && compareRoute.id !== route.id) {
      const compareSegments = compileInstructionSequence(compareRoute, layout.spawn)
      comparisonRun = simulateRoute(compareSegments, behaviorProfile, layout, state.seed + 1)
      comparison = compareRuns(run, comparisonRun)
    }

    await advanceStage('replay')
    const solveTimeMs = performance.now() - startedAt
    run.solveSummary = {
      physicsSteps: run.solveSummary?.physicsSteps ?? run.trace.length,
      tracePoints: run.trace.length,
      checkpointChecks: run.solveSummary?.checkpointChecks ?? 0,
      monteCarloRuns: 0,
      solveTimeMs,
    }

    set({
      run,
      comparisonRun,
      comparison,
      playbackTime: 0,
      playbackState: 'paused',
      exportSheetText: updateSheetText(get(), run),
      statusMessage: 'Quick simulation completed.',
      isSolving: false,
      simulationPipeline: buildPipeline().map((stage) => ({
        ...stage,
        status: stage.id === 'confidence' ? 'skipped' : 'completed',
      })),
    })
  },

  runDeepAnalysis: async () => {
    const advanceStage = async (activeStageId: SimulationPipelineStage['id']) => {
      set((state) => ({
        simulationPipeline: buildPipeline().map((stage) => {
          const order = PIPELINE_TEMPLATE.findIndex((candidate) => candidate.id === stage.id)
          const activeOrder = PIPELINE_TEMPLATE.findIndex((candidate) => candidate.id === activeStageId)
          if (order < activeOrder) {
            return { ...stage, status: 'completed' }
          }
          if (stage.id === activeStageId) {
            return { ...stage, status: 'active' }
          }
          return state.simulationPipeline.find((candidate) => candidate.id === stage.id) ?? stage
        }),
      }))
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }

    const startedAt = performance.now()
    const state = get()
    const layout = getActiveLayout(state.project, state.activeLayoutId)
    const route = getActiveRoute(state.project, state.activeRouteId)
    const behaviorProfile = getActiveBehaviorProfile(state.project, state.activeBehaviorProfileId)

    set({
      isSolving: true,
      simulationMode: 'analysis',
      simulationPipeline: buildPipeline(),
      statusMessage: 'Running deep analysis...',
    })

    await advanceStage('compile')
    const plannedSegments = compileInstructionSequence(route, layout.spawn)
    await advanceStage('runtime')
    await advanceStage('planned')
    await advanceStage('actual')
    const run = simulateRoute(plannedSegments, behaviorProfile, layout, state.seed)
    await advanceStage('checks')
    await advanceStage('metrics')
    await advanceStage('confidence')
    const deepAnalysis = runDeepAnalysis(plannedSegments, behaviorProfile, layout, state.seed + 20, state.monteCarloRuns)
    await advanceStage('replay')

    const solveTimeMs = performance.now() - startedAt
    run.solveSummary = {
      physicsSteps: run.solveSummary?.physicsSteps ?? run.trace.length,
      tracePoints: run.trace.length,
      checkpointChecks: run.solveSummary?.checkpointChecks ?? 0,
      monteCarloRuns: deepAnalysis.sampleCount,
      solveTimeMs,
    }
    run.metrics.completionSuccessEstimate = deepAnalysis.successEstimate

    set({
      run,
      deepAnalysis,
      playbackTime: 0,
      playbackState: 'paused',
      exportSheetText: updateSheetText(get(), run),
      statusMessage: 'Deep analysis completed.',
      isSolving: false,
      simulationPipeline: buildPipeline().map((stage) => ({ ...stage, status: 'completed' })),
    })
  },

  undo: () => {
    const state = get()
    const previous = state.past.at(-1)
    if (!previous) {
      return
    }

    set((current) => ({
      ...cloneSnapshot(previous),
      future: [buildSnapshot(current), ...current.future],
      past: current.past.slice(0, -1),
      run: null,
      comparisonRun: null,
      comparison: null,
      deepAnalysis: null,
      playbackTime: 0,
      playbackState: 'idle',
      simulationPipeline: buildPipeline(),
      exportSheetText: manualSheetToText(
        formatManualSheet(getActiveRoute(previous.project, previous.activeRouteId), null),
      ),
    }))
  },

  redo: () => {
    const state = get()
    const next = state.future[0]
    if (!next) {
      return
    }

    set((current) => ({
      ...cloneSnapshot(next),
      past: [...current.past, buildSnapshot(current)].slice(-MAX_HISTORY_ENTRIES),
      future: current.future.slice(1),
      run: null,
      comparisonRun: null,
      comparison: null,
      deepAnalysis: null,
      playbackTime: 0,
      playbackState: 'idle',
      simulationPipeline: buildPipeline(),
      exportSheetText: manualSheetToText(
        formatManualSheet(getActiveRoute(next.project, next.activeRouteId), null),
      ),
    }))
  },

  clearStatus: () => {
    set({ statusMessage: null })
  },
}))
