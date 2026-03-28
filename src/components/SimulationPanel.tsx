import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { distanceBetween } from '../core/math'
import { getTracePointAtTime } from '../core/simulation/analysis'
import { useProjectStore } from '../store/projectStore'

function formatMs(value: number) {
  return `${Math.round(value)} ms`
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 border-t border-white/8 pt-5 first:border-t-0 first:pt-0">
      <div className="grid gap-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">{title}</h2>
        <p className="text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'accent' | 'success' | 'danger'
}) {
  const toneClass =
    tone === 'accent'
      ? 'text-amber-200'
      : tone === 'success'
        ? 'text-emerald-200'
        : tone === 'danger'
          ? 'text-rose-200'
          : 'text-stone-100'

  return (
    <div className="grid gap-1 rounded-2xl border border-white/8 bg-white/[0.025] px-3.5 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</span>
      <strong className={`text-sm font-semibold ${toneClass}`}>{value}</strong>
    </div>
  )
}

export function SimulationPanel() {
  const {
    run,
    deepAnalysis,
    simulationPipeline,
    isSolving,
    monteCarloRuns,
    playbackTime,
  } = useProjectStore(
    useShallow((state) => ({
      run: state.run,
      deepAnalysis: state.deepAnalysis,
      simulationPipeline: state.simulationPipeline,
      isSolving: state.isSolving,
      monteCarloRuns: state.monteCarloRuns,
      playbackTime: state.playbackTime,
    })),
  )

  const activeTrace = useMemo(
    () => (run ? getTracePointAtTime(run.trace, playbackTime) : null),
    [playbackTime, run],
  )
  const drift = activeTrace
    ? distanceBetween(activeTrace.actualPosition, activeTrace.plannedPosition)
    : 0
  const checkpointHits = run?.checkpointResults.filter((checkpoint) => checkpoint.status === 'hit').length ?? 0
  const checkpointCount = run?.checkpointResults.length ?? 0

  return (
    <div className="grid gap-5">
      <Section
        title="Simulation Pipeline"
        subtitle={isSolving ? 'Live solver progress.' : 'Solve stages and replay readiness.'}
      >
        <div className="grid gap-3">
          {simulationPipeline.map((stage) => (
            <div
              key={stage.id}
              className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  stage.status === 'completed'
                    ? 'bg-emerald-400'
                    : stage.status === 'active'
                      ? 'bg-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.55)]'
                      : stage.status === 'skipped'
                        ? 'bg-slate-700'
                        : 'bg-slate-600'
                }`}
              />
              <span className="text-sm text-slate-300">{stage.label}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {stage.status}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Replay Telemetry"
        subtitle="Current trace values at the playhead."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile label="Time" value={`${playbackTime.toFixed(2)} s`} tone="accent" />
          <StatTile label="Speed" value={`${activeTrace?.actualSpeed.toFixed(1) ?? '0.0'} cm/s`} />
          <StatTile label="Heading" value={`${activeTrace?.actualHeading.toFixed(0) ?? '0'} deg`} />
          <StatTile label="Altitude" value={`${activeTrace?.actualPosition.y.toFixed(1) ?? '0.0'} cm`} />
          <StatTile label="Drift" value={`${drift.toFixed(1)} cm`} />
          <StatTile label="Checkpoint" value={`${checkpointHits}/${checkpointCount}`} tone={checkpointHits === checkpointCount && checkpointCount > 0 ? 'success' : 'default'} />
        </div>
      </Section>

      <Section
        title="Mission Status"
        subtitle="Checkpoint order, route validity, and landing evaluation."
      >
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile
              label="Route Validity"
              value={run?.metrics.routeValid ? 'Valid' : 'Invalid'}
              tone={run?.metrics.routeValid ? 'success' : 'danger'}
            />
            <StatTile
              label="Landing"
              value={run?.landingResult.surface ?? 'none'}
              tone={run?.landingResult.valid ? 'default' : 'danger'}
            />
          </div>
          {run?.metrics.routeInvalidReason ? (
            <p className="rounded-2xl border border-rose-400/15 bg-rose-400/8 px-3.5 py-3 text-sm text-rose-100">
              {run.metrics.routeInvalidReason}
            </p>
          ) : null}
          <div className="grid gap-2">
            {(run?.checkpointResults ?? []).map((checkpoint) => (
              <div key={checkpoint.checkpointId} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5 text-sm">
                <span className="text-slate-300">
                  {checkpoint.order}. {checkpoint.label}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    checkpoint.status === 'hit'
                      ? 'text-emerald-300'
                      : checkpoint.status === 'pending'
                        ? 'text-slate-500'
                        : 'text-rose-300'
                  }`}
                >
                  {checkpoint.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Simulation Summary"
        subtitle="Solve cost, output size, and repeatability details."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile label="Seed" value={String(run?.solveSummary?.seed ?? run?.seed ?? 0)} />
          <StatTile label="Route Time" value={`${run?.metrics.totalTime.toFixed(2) ?? '0.00'} s`} />
          <StatTile label="Physics Steps" value={String(run?.solveSummary?.physicsSteps ?? 0)} />
          <StatTile label="Trace Points" value={String(run?.solveSummary?.tracePoints ?? 0)} />
          <StatTile label="Checkpoint Checks" value={String(run?.solveSummary?.checkpointChecks ?? 0)} />
          <StatTile label="Collisions" value={String(run?.metrics.collisionCount ?? 0)} tone={(run?.metrics.collisionCount ?? 0) > 0 ? 'danger' : 'default'} />
          <StatTile label="Avg Noise" value={run?.solveSummary?.averageNoiseMagnitude?.toFixed(3) ?? '0.000'} />
          <StatTile label="Drift Accumulation" value={`${run?.solveSummary?.driftAccumulation?.toFixed(1) ?? '0.0'} cm`} />
          <StatTile label="Monte Carlo Runs" value={String(run?.solveSummary?.monteCarloRuns ?? 0)} />
          <StatTile label="Wall Clock" value={formatMs(run?.solveSummary?.solveTimeMs ?? 0)} />
        </div>
      </Section>

      <Section
        title="Deep Analysis"
        subtitle={`Confidence stats across seeded runs. Current sample target: ${monteCarloRuns}.`}
      >
        {deepAnalysis ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile label="Success Estimate" value={`${deepAnalysis.successEstimate}%`} tone="accent" />
            <StatTile label="Avg Deviation" value={`${deepAnalysis.averagePathDeviation.toFixed(1)} cm`} />
            <StatTile label="Worst Deviation" value={`${deepAnalysis.worstDeviation.toFixed(1)} cm`} tone="danger" />
            <StatTile label="Best / Worst Time" value={`${deepAnalysis.bestTime.toFixed(2)} s / ${deepAnalysis.worstTime.toFixed(2)} s`} />
            <StatTile label="Collision Range" value={`${deepAnalysis.collisionCountMin} - ${deepAnalysis.collisionCountMax}`} />
            <StatTile label="Consistency Spread" value={deepAnalysis.consistencySpread.toFixed(2)} />
          </div>
        ) : (
          <p className="rounded-2xl border border-white/6 bg-white/[0.02] px-3.5 py-3 text-sm leading-6 text-slate-500">
            Run Deep Analysis to compute confidence across 25, 50, or 100 seeded simulations.
          </p>
        )}
      </Section>
    </div>
  )
}
