import { useState } from 'react'

import { useProjectStore } from '../store/projectStore'
import { TimelinePanel } from './TimelinePanel'

export function Timeline() {
  const playbackTime = useProjectStore((state) => state.playbackTime)
  const run = useProjectStore((state) => state.run)
  const [collapsed, setCollapsed] = useState(false)

  const timeLabel = run
    ? `${playbackTime.toFixed(2)}s / ${run.metrics.totalTime.toFixed(2)}s`
    : 'No replay loaded'

  if (collapsed) {
    return (
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">Timeline</span>
          <span className="text-[11px] text-slate-600">{timeLabel}</span>
        </div>
        <button
          type="button"
          className="text-[11px] text-slate-500 transition hover:text-slate-200"
          onClick={() => setCollapsed(false)}
        >
          Expand
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">Timeline</span>
          <span className="text-[11px] text-slate-600">{timeLabel}</span>
        </div>
        <button
          type="button"
          className="text-[11px] text-slate-600 transition hover:text-slate-300"
          onClick={() => setCollapsed(true)}
        >
          Collapse
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
        <TimelinePanel />
      </div>
    </div>
  )
}
