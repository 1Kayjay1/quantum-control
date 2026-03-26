import type { ChangeEvent } from 'react'
import { startTransition, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { downloadTextFile } from '../core/downloads'
import { useProjectStore } from '../store/projectStore'

const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06] hover:text-white'

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const {
    project,
    projectSummaries,
    saveProject,
    loadProject,
    setProjectName,
    exportProjectJson,
    exportSheetText,
    runQuickSimulation,
    runDeepAnalysis,
    resetPlayback,
    setPlaybackState,
    playbackState,
    playbackSpeed,
    setPlaybackSpeed,
    statusMessage,
    importProjectFromJson,
    simulationMode,
    setSimulationMode,
    monteCarloRuns,
    setMonteCarloRuns,
    isSolving,
    workspaceMode,
    setWorkspaceMode,
    timelineDockState,
    setTimelineDockState,
    physicsDebugEnabled,
    setPhysicsDebugEnabled,
  } = useProjectStore(
    useShallow((state) => ({
      project: state.project,
      projectSummaries: state.projectSummaries,
      saveProject: state.saveProject,
      loadProject: state.loadProject,
      setProjectName: state.setProjectName,
      exportProjectJson: state.exportProjectJson,
      exportSheetText: state.exportSheetText,
      runQuickSimulation: state.runQuickSimulation,
      runDeepAnalysis: state.runDeepAnalysis,
      resetPlayback: state.resetPlayback,
      setPlaybackState: state.setPlaybackState,
      playbackState: state.playbackState,
      playbackSpeed: state.playbackSpeed,
      setPlaybackSpeed: state.setPlaybackSpeed,
      statusMessage: state.statusMessage,
      importProjectFromJson: state.importProjectFromJson,
      simulationMode: state.simulationMode,
      setSimulationMode: state.setSimulationMode,
      monteCarloRuns: state.monteCarloRuns,
      setMonteCarloRuns: state.setMonteCarloRuns,
      isSolving: state.isSolving,
      workspaceMode: state.workspaceMode,
      setWorkspaceMode: state.setWorkspaceMode,
      timelineDockState: state.timelineDockState,
      setTimelineDockState: state.setTimelineDockState,
      physicsDebugEnabled: state.physicsDebugEnabled,
      setPhysicsDebugEnabled: state.setPhysicsDebugEnabled,
    })),
  )

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const content = await file.text()
    await importProjectFromJson(content)
    event.target.value = ''
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-[#050912]/90 backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-[1880px] grid-cols-[minmax(300px,1fr)_auto_minmax(260px,1fr)] items-center gap-6 px-8 py-4 max-[1320px]:grid-cols-1 max-[1320px]:gap-4 max-[1320px]:px-5">
        <div className="flex min-w-0 items-center gap-4 max-[900px]:flex-col max-[900px]:items-start">
          <div className="grid min-w-0 gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-300/80">
              Quantum Control
            </span>
            <input
              className="min-w-0 bg-transparent text-[clamp(1.35rem,1.6vw,1.95rem)] font-semibold tracking-[-0.04em] text-stone-100 outline-none"
              value={project.name}
              onChange={(event) => setProjectName(event.target.value)}
              aria-label="Project name"
            />
            <p className="text-sm text-slate-500">
              {statusMessage ?? 'Manual-only route planning and simulation workspace.'}
            </p>
          </div>

          <label className="grid min-w-[180px] gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Project
            </span>
            <select
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-amber-400/40 focus:bg-white/[0.05]"
              value={project.id}
              onChange={(event) => {
                void loadProject(event.target.value)
              }}
            >
              {projectSummaries.map((summary) => (
                <option key={summary.id} value={summary.id}>
                  {summary.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 max-[1320px]:justify-start">
          <div className="flex items-center rounded-xl border border-white/8 bg-white/[0.03] p-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                workspaceMode === 'editor' ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setWorkspaceMode('editor')}
            >
              Editor
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                workspaceMode === 'scene' ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setWorkspaceMode('scene')}
            >
              Scene
            </button>
          </div>
          <select
            className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-amber-400/40 focus:bg-white/[0.05]"
            value={simulationMode}
            onChange={(event) => setSimulationMode(event.target.value as 'quick' | 'replay' | 'analysis')}
          >
            <option value="quick">Quick Sim</option>
            <option value="replay">Replay Mode</option>
            <option value="analysis">Deep Analysis</option>
          </select>
          {simulationMode === 'analysis' ? (
            <select
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-amber-400/40 focus:bg-white/[0.05]"
              value={monteCarloRuns}
              onChange={(event) => setMonteCarloRuns(Number(event.target.value))}
            >
              <option value={25}>25 runs</option>
              <option value={50}>50 runs</option>
              <option value={100}>100 runs</option>
            </select>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            onClick={() => {
              startTransition(() => {
                void (simulationMode === 'analysis' ? runDeepAnalysis() : runQuickSimulation())
              })
            }}
            disabled={isSolving}
          >
            {isSolving
              ? 'Solving...'
              : simulationMode === 'analysis'
                ? 'Run Deep Analysis'
                : 'Run Simulation'}
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing')}
            disabled={isSolving}
          >
            {playbackState === 'playing' ? 'Pause' : 'Play'}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={resetPlayback}>
            Reset
          </button>
          <select
            className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-amber-400/40 focus:bg-white/[0.05]"
            value={playbackSpeed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
          {workspaceMode === 'scene' ? (
            <select
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-amber-400/40 focus:bg-white/[0.05]"
              value={timelineDockState}
              onChange={(event) =>
                setTimelineDockState(event.target.value as 'collapsed' | 'edit' | 'analysis')
              }
            >
              <option value="collapsed">Dock Collapsed</option>
              <option value="edit">Dock Edit</option>
              <option value="analysis">Dock Analysis</option>
            </select>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 max-[1320px]:justify-start">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => setPhysicsDebugEnabled(!physicsDebugEnabled)}
          >
            {physicsDebugEnabled ? 'Hide Debug' : 'Physics Debug'}
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              void saveProject()
            }}
          >
            Save
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() =>
              downloadTextFile('quantum-control-project.json', exportProjectJson(), 'application/json')
            }
          >
            Export
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => downloadTextFile('quantum-control-manual-sheet.txt', exportSheetText)}
          >
            Sheet
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="sr-only"
          onChange={(event) => {
            void handleImportChange(event)
          }}
        />
      </div>
    </header>
  )
}
