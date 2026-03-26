import { create } from 'zustand'

import { GRID_SIZE_CM, MAX_HISTORY_ENTRIES, MONTE_CARLO_RUNS } from '../core/constants'
import { formatManualSheet, manualSheetToText } from '../core/export/manualSheet'
import { createId } from '../core/id'
import { invertInstructionKind } from '../core/instructions'
import { clamp, roundToGrid } from '../core/math'
import { createFieldObject, createInstructionBlock, INSTRUCTION_LIBRARY } from '../core/presets'
import { getActiveBehaviorProfile, getActiveLayout, getActiveRoute, getCompareRoute } from '../core/selectors'
import { createStarterProject } from '../core/sampleProject'
import { compileInstructionSequence } from '../core/simulation/compile'
import { compareRuns } from '../core/simulation/analysis'
import { simulateRoute } from '../core/simulation/simulate'
import { getStoredProject, listStoredProjects, saveStoredProject } from '../core/storage/db'
import type {
  BehaviorProfile,
  ComparisonSnapshot,
  FieldObject,
  FieldObjectType,
  InstructionBlock,
  InstructionKind,
  PlaybackState,
  Project,
  ProjectSummary,
  RouteVersion,
  SimulationRun,
} from '../core/types'

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
  seed: number
  monteCarloRuns: number
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
  jumpToInstruction: (instructionId: string) => void
  resetPlayback: () => void
  setSeed: (seed: number) => void
  runSimulation: () => void
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
    playbackTime: 0,
    playbackState: 'idle',
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
    altitudeHoldGain: profile.altitudeHoldGain ?? 5.8,
    attitudeHoldGain: profile.attitudeHoldGain ?? 1,
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
  seed: 7,
  monteCarloRuns: MONTE_CARLO_RUNS,
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
      playbackTime: 0,
      playbackState: 'idle',
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
      playbackTime: 0,
      playbackState: 'idle',
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
      playbackTime: 0,
      playbackState: 'idle',
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
      playbackTime: 0,
      playbackState: 'idle',
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
    })
  },

  deleteFieldObject: (objectId) => {
    withMutation(set, get, (draft) => {
      const layout = getActiveLayout(draft.project, draft.activeLayoutId)
      layout.objects = layout.objects.filter((object) => object.id !== objectId)
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

  runSimulation: () => {
    const state = get()
    const layout = getActiveLayout(state.project, state.activeLayoutId)
    const route = getActiveRoute(state.project, state.activeRouteId)
    const behaviorProfile = getActiveBehaviorProfile(state.project, state.activeBehaviorProfileId)
    const plannedSegments = compileInstructionSequence(route, layout.spawn)
    const run = simulateRoute(plannedSegments, behaviorProfile, layout, state.seed)
    const compareRoute = getCompareRoute(state.project, state.compareRouteId)

    let comparisonRun: SimulationRun | null = null
    let comparison: ComparisonSnapshot | null = null

    if (compareRoute && compareRoute.id !== route.id) {
      const compareSegments = compileInstructionSequence(compareRoute, layout.spawn)
      comparisonRun = simulateRoute(compareSegments, behaviorProfile, layout, state.seed + 1)
      comparison = compareRuns(run, comparisonRun)
    }

    set({
      run,
      comparisonRun,
      comparison,
      playbackTime: 0,
      playbackState: 'paused',
      exportSheetText: updateSheetText(state, run),
      statusMessage: 'Simulation completed.',
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
      playbackTime: 0,
      playbackState: 'idle',
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
      playbackTime: 0,
      playbackState: 'idle',
      exportSheetText: manualSheetToText(
        formatManualSheet(getActiveRoute(next.project, next.activeRouteId), null),
      ),
    }))
  },

  clearStatus: () => {
    set({ statusMessage: null })
  },
}))
