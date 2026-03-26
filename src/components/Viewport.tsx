import { FieldViewport } from './FieldViewport'
import { useProjectStore } from '../store/projectStore'

export function Viewport() {
  const workspaceMode = useProjectStore((state) => state.workspaceMode)

  return (
    <section
      className={
        workspaceMode === 'scene'
          ? 'h-full w-full overflow-hidden'
          : 'overflow-hidden rounded-[28px] border border-white/10 bg-[#050b14]/60 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.36)]'
      }
    >
      <FieldViewport />
    </section>
  )
}
