import { useEffect, useEffectEvent } from 'react'

import { PLAYBACK_TICK_MS } from './core/constants'
import { LeftRail } from './components/LeftRail'
import { RightDrawer } from './components/RightDrawer'
import { Timeline } from './components/Timeline'
import { TopBar } from './components/TopBar'
import { Viewport } from './components/Viewport'
import { useProjectStore } from './store/projectStore'

function App() {
  const hydrated = useProjectStore((state) => state.hydrated)
  const bootstrap = useProjectStore((state) => state.bootstrap)
  const saveProject = useProjectStore((state) => state.saveProject)
  const projectUpdatedAt = useProjectStore((state) => state.project.updatedAt)
  const playbackState = useProjectStore((state) => state.playbackState)
  const playbackSpeed = useProjectStore((state) => state.playbackSpeed)
  const playbackTime = useProjectStore((state) => state.playbackTime)
  const run = useProjectStore((state) => state.run)
  const setPlaybackTime = useProjectStore((state) => state.setPlaybackTime)
  const setPlaybackState = useProjectStore((state) => state.setPlaybackState)
  const statusMessage = useProjectStore((state) => state.statusMessage)
  const clearStatus = useProjectStore((state) => state.clearStatus)
  const workspaceMode = useProjectStore((state) => state.workspaceMode)
  const timelineDockState = useProjectStore((state) => state.timelineDockState)
  const setWorkspaceMode = useProjectStore((state) => state.setWorkspaceMode)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const advancePlayback = useEffectEvent((deltaSeconds: number) => {
    if (!run) {
      return
    }

    const nextTime = playbackTime + deltaSeconds
    if (nextTime >= run.metrics.totalTime) {
      setPlaybackTime(run.metrics.totalTime)
      setPlaybackState('paused')
      return
    }

    setPlaybackTime(nextTime)
  })

  useEffect(() => {
    if (playbackState !== 'playing' || !run) {
      return
    }

    let lastTick = performance.now()
    const interval = window.setInterval(() => {
      const now = performance.now()
      const elapsedSeconds = ((now - lastTick) / 1000) * playbackSpeed
      lastTick = now
      advancePlayback(elapsedSeconds)
    }, PLAYBACK_TICK_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [playbackSpeed, playbackState, run])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    const timeout = window.setTimeout(() => {
      void saveProject()
    }, 900)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [hydrated, projectUpdatedAt, saveProject])

  useEffect(() => {
    if (!statusMessage) {
      return
    }

    const timeout = window.setTimeout(() => {
      clearStatus()
    }, 2600)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [clearStatus, statusMessage])

  useEffect(() => {
    if (workspaceMode !== 'scene') {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWorkspaceMode('editor')
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [setWorkspaceMode, workspaceMode])

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="grid max-w-lg gap-4 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300/80">
            Quantum Control
          </span>
          <strong className="text-3xl font-semibold tracking-[-0.05em] text-stone-100">
            Preparing the simulator workspace...
          </strong>
          <p className="text-sm leading-6 text-slate-500">
            Loading local projects, route versions, field layouts, and replay state.
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen">
      <TopBar />
      {workspaceMode === 'scene' ? (
        <main className="relative min-h-screen px-4 pb-4 pt-[96px]">
          <section className="relative h-[calc(100vh-116px)] overflow-hidden rounded-[30px] border border-white/10 bg-[#030812] shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
            <Viewport />
            <div
              className={`absolute inset-x-0 bottom-0 z-30 transition-all duration-300 ${
                timelineDockState === 'collapsed'
                  ? 'translate-y-[calc(100%-56px)]'
                  : timelineDockState === 'analysis'
                    ? 'h-[44vh]'
                    : 'h-[34vh]'
              }`}
            >
              <div className="h-full border-t border-white/10 bg-[#07101be8] px-5 pb-4 pt-3 backdrop-blur-xl">
                <Timeline />
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-[1760px] grid-cols-[232px_minmax(0,1fr)_300px] gap-x-6 px-6 pb-10 pt-[110px] max-[1320px]:grid-cols-1 max-[1320px]:gap-y-10 max-[1320px]:px-5 max-[1320px]:pt-[170px]">
          <LeftRail />

          <section className="grid min-w-0 content-start gap-8">
            <Viewport />
            <Timeline />
          </section>

          <RightDrawer />
        </main>
      )}
    </div>
  )
}

export default App
