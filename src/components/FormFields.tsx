import type { ReactNode } from 'react'

function FieldShell({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  )
}

const CONTROL_CLASS =
  'w-full rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-amber-400/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-amber-400/15'

interface NumberFieldProps {
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (value: number) => void
}

export function NumberField({
  label,
  value,
  step = 1,
  min,
  max,
  onChange,
}: NumberFieldProps) {
  return (
    <FieldShell label={label}>
      <input
        className={CONTROL_CLASS}
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </FieldShell>
  )
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <FieldShell label={label}>
      <input
        className={CONTROL_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <FieldShell label={label}>
      <textarea
        className={`${CONTROL_CLASS} min-h-28 resize-y`}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display?: string
  onChange: (value: number) => void
}) {
  return (
    <FieldShell label={label}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <input
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-400"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <strong className="text-xs font-semibold text-slate-200">{display ?? value}</strong>
      </div>
    </FieldShell>
  )
}

export function SelectField<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: TValue
  options: Array<{ label: string; value: TValue }>
  onChange: (value: TValue) => void
}) {
  return (
    <FieldShell label={label}>
      <select
        className={CONTROL_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
