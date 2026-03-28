import type { ChangeEvent } from 'react'
import { startTransition, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { downloadTextFile } from '../core/downloads'
import { useProjectStore } from '../store/projectStore'
import { LAYOUT_PROTOTYPES, type LayoutPrototype } from '../ui/layoutPrototype'

const btn =
  'inline-flex h-6 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-35'

const btnAccent =
  'inline-flex h-6 items-center justify-center rounded-md bg-amber-400 px-2.5 text-[11px] font-semibold text-slate-950 transition hover:bg-amber-300 disabled:pointer-events-none disabled:opacity-50'

const sel =
  'h-6 rounded-md border border-white/[0.08] bg-[#0a1320] px-2 text-[11px] text-slate-300 outline-none transition hover:border-white/[0.14] focus:border-amber-400/40'

const sep = <span className="h-3.5 w-px flex-shrink-0 bg-white/[0.1]" />

function formatSaveStatus(lastSavedAt: string | null, statusMessage: string | null) {
  if (statusMessage) return statusMessage
  if (!lastSavedAt) return 'Unsaved'
  return `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function IconPlay() {
  return <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><polygon points="1,0.5 8.5,4.5 1,8.5" /></svg>
}
function IconPause() {
  return <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><rect x="1" y="0.5" width="2.5" height="8" rx="0.5"/><rect x="5.5" y="0.5" width="2.5" height="8" rx="0.5"/></svg>
}
function IconReset() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
}
function IconUndo() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
}
function IconRedo() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
}
function IconCog() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export function TopBar({
  layoutPrototype,
  setLayoutPrototype,
  inspectorOpen,
  onToggleInspector,
  showPrototypeSwitcher = true,
}: {
  layoutPrototype: LayoutPrototype
  setLayoutPrototype: (prototype: LayoutPrototype) => void
  inspectorOpen: boolean
  onToggleInspector: () => void
  showPrototypeSwitcher?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)

  const {
    project, projectSummaries, saveProject, loadProject, setProjectName,
    exportProjectJson, exportSheetText, runQuickSimulation, runDeepAnalysis,
    resetPlayback, setPlaybackState, playbackState, playbackSpeed, setPlaybackSpeed,
    statusMessage, importProjectFromJson, simulationMode, setSimulationMode,
    monteCarloRuns, setMonteCarloRuns, isSolving, workspaceMode, setWorkspaceMode,
    physicsDebugEnabled, setPhysicsDebugEnabled, undo, redo, past, future, lastSavedAt,
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
      physicsDebugEnabled: state.physicsDebugEnabled,
      setPhysicsDebugEnabled: state.setPhysicsDebugEnabled,
      undo: state.undo,
      redo: state.redo,
      past: state.past,
      future: state.future,
      lastSavedAt: state.lastSavedAt,
    })),
  )

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const content = await file.text()
    await importProjectFromJson(content)
    event.target.value = ''
  }

  return (
    <>
      {/* Floating cogwheel trigger */}
      <div className="fixed right-3 top-3 z-50">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
            open
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              : 'border-white/[0.1] bg-[#0a1320]/90 text-slate-400 hover:border-white/[0.18] hover:text-slate-200'
          } shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md`}
          title="Settings"
          aria-label="Toggle controls"
        >
          <span className={`transition-transform duration-300 ${open ? 'rotate-90' : ''}`}>
            <IconCog />
          </span>
        </button>
      </div>

      {/* Popover panel */}
      {open && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="fixed right-3 top-13 z-50 w-[420px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1320]/98 shadow-[0_8px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            {/* Project row */}
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-amber-400">QC</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-stone-100 outline-none"
                value={project.name}
                onChange={(e) => setProjectName(e.target.value)}
                aria-label="Project name"
              />
              <span className="text-[10px] text-slate-600">{formatSaveStatus(lastSavedAt, statusMessage)}</span>
              <select className={sel} value={project.id} onChange={(e) => { void loadProject(e.target.value) }} aria-label="Project">
                {projectSummaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Controls rows */}
            <div className="flex flex-col gap-2 px-3 py-2.5">
              {/* Row 1: mode + undo/redo */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-[10px] text-slate-600">View</span>
                <div className="flex items-center rounded-md border border-white/[0.08] bg-black/20 p-0.5">
                  {(['editor', 'scene'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize transition ${workspaceMode === mode ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'}`}
                      onClick={() => setWorkspaceMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {sep}
                <button type="button" className={btn} onClick={undo} disabled={past.length === 0} title="Undo"><IconUndo /></button>
                <button type="button" className={btn} onClick={redo} disabled={future.length === 0} title="Redo"><IconRedo /></button>
              </div>

              {/* Row 2: simulation */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-[10px] text-slate-600">Simulate</span>
                <select className={sel} value={simulationMode} onChange={(e) => setSimulationMode(e.target.value as 'quick' | 'replay' | 'analysis')} aria-label="Simulation mode">
                  <option value="quick">Quick Sim</option>
                  <option value="replay">Replay</option>
                  <option value="analysis">Deep Analysis</option>
                </select>
                {simulationMode === 'analysis' && (
                  <select className={sel} value={monteCarloRuns} onChange={(e) => setMonteCarloRuns(Number(e.target.value))} aria-label="Analysis runs">
                    <option value={25}>25 runs</option>
                    <option value={50}>50 runs</option>
                    <option value={100}>100 runs</option>
                  </select>
                )}
                <button
                  type="button"
                  className={btnAccent}
                  onClick={() => { startTransition(() => { void (simulationMode === 'analysis' ? runDeepAnalysis() : runQuickSimulation()) }) }}
                  disabled={isSolving}
                >
                  {isSolving ? 'Running…' : simulationMode === 'analysis' ? 'Analyze' : 'Simulate'}
                </button>
              </div>

              {/* Row 3: playback */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-[10px] text-slate-600">Playback</span>
                <button type="button" className={btn} onClick={() => setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing')} disabled={isSolving}>
                  {playbackState === 'playing' ? <IconPause /> : <IconPlay />}
                </button>
                <button type="button" className={btn} onClick={resetPlayback} title="Reset"><IconReset /></button>
                <select className={sel} value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} aria-label="Playback speed">
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={2}>2×</option>
                </select>
              </div>

              {/* Row 4: utilities */}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2">
                <span className="w-16 text-[10px] text-slate-600">Tools</span>
                <button type="button" className={`${btn} ${physicsDebugEnabled ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' : ''}`} onClick={() => setPhysicsDebugEnabled(!physicsDebugEnabled)}>Debug</button>
                <button type="button" className={btn} onClick={onToggleInspector}>{inspectorOpen ? 'Hide Panel' : 'Panel'}</button>
                <button type="button" className={btn} onClick={() => { void saveProject() }}>Save</button>
                <button type="button" className={btn} onClick={() => downloadTextFile('quantum-control-project.json', exportProjectJson(), 'application/json')}>Export</button>
                <button type="button" className={btn} onClick={() => downloadTextFile('quantum-control-manual-sheet.txt', exportSheetText)}>Sheet</button>
                <button type="button" className={btn} onClick={() => fileInputRef.current?.click()}>Import</button>
                {showPrototypeSwitcher && (
                  <select className={sel} value={layoutPrototype} onChange={(e) => setLayoutPrototype(e.target.value as LayoutPrototype)} aria-label="Layout prototype">
                    {LAYOUT_PROTOTYPES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <input ref={fileInputRef} type="file" accept="application/json" className="sr-only" onChange={(e) => { void handleImportChange(e) }} />
    </>
  )
}
