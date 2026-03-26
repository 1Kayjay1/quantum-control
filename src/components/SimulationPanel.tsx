import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { distanceBetween } from '../core/math'
import { getTracePointAtTime } from '../core/simulation/analysis'
import { useProjectStore } from '../store/projectStore'

function formatMs(value: number) {
  return `${Math.round(value)} ms`
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
    <section className="grid gap-8">
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Simulation Pipeline</h2>
          <p className="text-sm leading-6 text-slate-500">
            {isSolving ? 'Live solve progress.' : 'Current solver pass and replay readiness.'}
          </p>
        </div>
        <div className="grid gap-3">
          {simulationPipeline.map((stage) => (
            <div key={stage.id} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-3">
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
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                {stage.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Replay Telemetry</h2>
          <p className="text-sm leading-6 text-slate-500">
            Real-time trace values from the completed run.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Time</span>
            <strong className="text-sm text-stone-100">{playbackTime.toFixed(2)} s</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Speed</span>
            <strong className="text-sm text-stone-100">{activeTrace?.actualSpeed.toFixed(1) ?? '0.0'} cm/s</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Heading</span>
            <strong className="text-sm text-stone-100">{activeTrace?.actualHeading.toFixed(0) ?? '0'} deg</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Altitude</span>
            <strong className="text-sm text-stone-100">{activeTrace?.actualPosition.y.toFixed(1) ?? '0.0'} cm</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Drift</span>
            <strong className="text-sm text-stone-100">{drift.toFixed(1)} cm</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Checkpoint Status</span>
            <strong className="text-sm text-stone-100">{checkpointHits}/{checkpointCount}</strong>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Mission Status</h2>
          <p className="text-sm leading-6 text-slate-500">
            Ordered checkpoint state, route validity, and landing evaluation.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Route Validity</span>
            <strong className="text-sm text-stone-100">
              {run?.metrics.routeValid ? 'Valid' : 'Invalid'}
            </strong>
            {run?.metrics.routeInvalidReason ? (
              <span className="text-sm text-rose-200">{run.metrics.routeInvalidReason}</span>
            ) : null}
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Landing Result</span>
            <strong className="text-sm text-stone-100">
              {run?.landingResult.surface ?? 'none'}
            </strong>
            <span className="text-sm text-slate-400">{run?.landingResult.message ?? 'No landing result yet.'}</span>
          </div>
          <div className="grid gap-2">
            {(run?.checkpointResults ?? []).map((checkpoint) => (
              <div key={checkpoint.checkpointId} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">
                  {checkpoint.order}. {checkpoint.label}
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-[0.16em] ${
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
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Simulation Summary</h2>
          <p className="text-sm leading-6 text-slate-500">
            Solve cost and output size without artificially slowing the engine.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Route Time</span>
            <strong className="text-sm text-stone-100">{run?.metrics.totalTime.toFixed(2) ?? '0.00'} s</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Physics Steps</span>
            <strong className="text-sm text-stone-100">{run?.solveSummary?.physicsSteps ?? 0}</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Trace Points</span>
            <strong className="text-sm text-stone-100">{run?.solveSummary?.tracePoints ?? 0}</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Checkpoint Checks</span>
            <strong className="text-sm text-stone-100">{run?.solveSummary?.checkpointChecks ?? 0}</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Monte Carlo Runs</span>
            <strong className="text-sm text-stone-100">{run?.solveSummary?.monteCarloRuns ?? 0}</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Wall Clock</span>
            <strong className="text-sm text-stone-100">{formatMs(run?.solveSummary?.solveTimeMs ?? 0)}</strong>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Deep Analysis</h2>
          <p className="text-sm leading-6 text-slate-500">
            Multi-seed confidence stats. Current sample target: {monteCarloRuns}.
          </p>
        </div>
        {deepAnalysis ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Success Estimate</span>
              <strong className="text-sm text-stone-100">{deepAnalysis.successEstimate}%</strong>
            </div>
            <div className="grid gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Avg Deviation</span>
              <strong className="text-sm text-stone-100">{deepAnalysis.averagePathDeviation.toFixed(1)} cm</strong>
            </div>
            <div className="grid gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Worst Deviation</span>
              <strong className="text-sm text-stone-100">{deepAnalysis.worstDeviation.toFixed(1)} cm</strong>
            </div>
            <div className="grid gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Best / Worst Time</span>
              <strong className="text-sm text-stone-100">
                {deepAnalysis.bestTime.toFixed(2)} s / {deepAnalysis.worstTime.toFixed(2)} s
              </strong>
            </div>
            <div className="grid gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Collision Range</span>
              <strong className="text-sm text-stone-100">
                {deepAnalysis.collisionCountMin} - {deepAnalysis.collisionCountMax}
              </strong>
            </div>
            <div className="grid gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Consistency Spread</span>
              <strong className="text-sm text-stone-100">{deepAnalysis.consistencySpread.toFixed(2)}</strong>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-500">
            Run Deep Analysis to compute confidence across 25, 50, or 100 seeded simulations.
          </p>
        )}
      </div>
    </section>
  )
}
