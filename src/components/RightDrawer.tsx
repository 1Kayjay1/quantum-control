import { ControlCenter } from './ControlCenter'
import { RightPanel } from './RightPanel'
import { SimulationPanel } from './SimulationPanel'

export function RightDrawer() {
  return (
    <aside className="sticky top-[88px] self-start h-[calc(100vh-108px)] overflow-y-auto border-l border-white/8 bg-gradient-to-b from-white/[0.02] to-transparent pl-5 scrollbar-thin max-[1320px]:static max-[1320px]:h-auto max-[1320px]:border-l-0 max-[1320px]:pl-0">
      <div className="grid gap-8">
        <SimulationPanel />
        <RightPanel />
        <ControlCenter />
      </div>
    </aside>
  )
}
