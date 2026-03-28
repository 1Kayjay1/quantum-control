import { useState } from 'react'
import type { ReactNode } from 'react'

interface PanelSectionProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}

export function PanelSection({
  title,
  subtitle,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="grid gap-5 border-t border-white/8 pt-6 first:border-t-0 first:pt-0">
      <header className="flex items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">{title}</h2>
          {subtitle ? <p className="max-w-[38ch] text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          {collapsible ? (
            <button
              type="button"
              className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
            >
              {open ? 'Collapse' : 'Expand'}
            </button>
          ) : null}
        </div>
      </header>
      {(!collapsible || open) && <div className="grid gap-4">{children}</div>}
    </section>
  )
}
