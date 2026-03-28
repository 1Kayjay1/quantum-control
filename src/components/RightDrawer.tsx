import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { ControlCenter } from './ControlCenter'
import { RightPanel } from './RightPanel'
import { SimulationPanel } from './SimulationPanel'
import { useProjectStore } from '../store/projectStore'
import type { LayoutPrototype } from '../ui/layoutPrototype'

type DrawerTab = 'summary' | 'inspector' | 'setup'

export function RightDrawer({
  layoutPrototype,
  open = true,
  onOpenChange,
}: {
  layoutPrototype: LayoutPrototype
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { selectedInstructionId, selectedObjectId } = useProjectStore(
    useShallow((state) => ({
      selectedInstructionId: state.selectedInstructionId,
      selectedObjectId: state.selectedObjectId,
    })),
  )
  const [activeTab, setActiveTab] = useState<DrawerTab>('inspector')

  useEffect(() => {
    if (selectedInstructionId || selectedObjectId) {
      queueMicrotask(() => setActiveTab('inspector'))
    }
  }, [selectedInstructionId, selectedObjectId])

  if (layoutPrototype === 'viewport-first-tactical' && !open) return null

  const isOverlay = layoutPrototype === 'viewport-first-tactical'

  const outerClass = isOverlay
    ? 'fixed inset-y-10 right-0 z-50 flex w-[300px] flex-col border-l border-white/[0.06] bg-[#060c16]'
    : 'flex h-full flex-col'

  return (
    <div className={outerClass}>
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-slate-600">Inspector</p>
          <h2 className="mt-0.5 text-xs font-semibold text-slate-200">Right Bay</h2>
        </div>
        {isOverlay && (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:text-white"
            onClick={() => onOpenChange?.(false)}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l9 9M10 1L1 10" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0 border-b border-white/[0.06] px-3 py-1.5 gap-0.5">
        {(['inspector', 'summary', 'setup'] as DrawerTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`flex-1 rounded py-1 text-[11px] font-medium capitalize transition ${
              activeTab === tab ? 'bg-white/[0.07] text-white' : 'text-slate-600 hover:text-slate-300'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {activeTab === 'summary' && <SimulationPanel />}
        {activeTab === 'inspector' && <RightPanel flat={layoutPrototype === 'mission-control-balanced'} />}
        {activeTab === 'setup' && <ControlCenter />}
      </div>
    </div>
  )
}
