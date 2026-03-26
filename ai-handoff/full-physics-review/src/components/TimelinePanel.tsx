import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { formatInstructionLabel } from '../core/formatters'
import { canInvertInstructionKind, getInstructionFamily } from '../core/instructions'
import { clamp } from '../core/math'
import { getActiveLayout, getActiveRoute } from '../core/selectors'
import { compileInstructionSequence } from '../core/simulation/compile'
import type { InstructionBlock, PlannedSegment, RouteVersion } from '../core/types'
import { useProjectStore } from '../store/projectStore'

const BASE_PIXELS_PER_SECOND = 128
const CLIP_LANE_HEIGHT = 88
const CLIP_HEIGHT = 62
const TRACK_PADDING = 18
const EXTRA_TIMELINE_SECONDS = 6
const MIN_DURATION_SECONDS = 0.1

type DragMode = 'move' | 'resize-start' | 'resize-end'

interface InstructionPatch {
  instructionId: string
  patch: Partial<InstructionBlock>
}

interface DragSession {
  instructionId: string
  mode: DragMode
  originClientX: number
  originClientY: number
}

interface ContextMenuState {
  instructionId: string
  x: number
  y: number
}

function snapTime(value: number, resolution: number): number {
  if (resolution <= 0) {
    return value
  }

  return Math.round(value / resolution) * resolution
}

function getMinDuration(resolution: number): number {
  return Math.max(MIN_DURATION_SECONDS, resolution)
}

function buildDurationPatch(duration: number): Partial<InstructionBlock> {
  return { duration: Math.max(duration, 0) }
}

function buildRelationPatch(
  signedGap: number,
  resolution: number,
  availableDuration: number,
): Partial<InstructionBlock> {
  if (signedGap >= 0) {
    return {
      delayAfter: Math.max(0, snapTime(signedGap, resolution)),
      stackNextBy: 0,
    }
  }

  return {
    delayAfter: 0,
    stackNextBy: clamp(
      snapTime(-signedGap, resolution),
      0,
      Math.max(availableDuration - 0.05, 0),
    ),
  }
}

function applyInstructionPatchesToRoute(
  route: RouteVersion,
  patches: InstructionPatch[] | null,
): RouteVersion {
  if (!patches || patches.length === 0) {
    return route
  }

  const patchMap = new Map(patches.map((entry) => [entry.instructionId, entry.patch]))

  return {
    ...route,
    instructions: route.instructions.map((instruction) => ({
      ...instruction,
      ...(patchMap.get(instruction.id) ?? {}),
    })),
  }
}

function buildResizePatches(
  route: RouteVersion,
  segments: PlannedSegment[],
  instructionId: string,
  mode: 'resize-start' | 'resize-end',
  desiredTime: number,
): InstructionPatch[] {
  const index = segments.findIndex((segment) => segment.instructionId === instructionId)
  if (index < 0) {
    return []
  }

  const segment = segments[index]
  const instruction = route.instructions.find((candidate) => candidate.id === instructionId)
  if (!instruction) {
    return []
  }

  const resolution = route.timingResolution
  const minDuration = getMinDuration(resolution)
  const nextSegment = segments[index + 1]

  if (mode === 'resize-end') {
    const nextEnd = Math.max(segment.scheduledStart + minDuration, snapTime(desiredTime, resolution))
    const nextDuration = nextEnd - segment.scheduledStart
    const patches: InstructionPatch[] = [
      {
        instructionId,
        patch: buildDurationPatch(nextDuration),
      },
    ]

    if (nextSegment) {
      patches[0].patch = {
        ...patches[0].patch,
        ...buildRelationPatch(nextSegment.scheduledStart - nextEnd, resolution, nextDuration),
      }
    }

    return patches
  }

  if (index === 0) {
    return []
  }

  const previousSegment = segments[index - 1]
  const previousInstruction = route.instructions.find(
    (candidate) => candidate.id === previousSegment.instructionId,
  )
  if (!previousInstruction) {
    return []
  }

  const minStart = previousSegment.scheduledStart + 0.05
  const maxStart = segment.scheduledEnd - minDuration
  const nextStart = clamp(snapTime(desiredTime, resolution), minStart, maxStart)
  const nextDuration = segment.scheduledEnd - nextStart

  return [
    {
      instructionId: previousInstruction.id,
      patch: buildRelationPatch(
        nextStart - previousSegment.scheduledEnd,
        resolution,
        previousSegment.duration,
      ),
    },
    {
      instructionId,
      patch: buildDurationPatch(nextDuration),
    },
  ]
}

function buildMovePatches(
  route: RouteVersion,
  segments: PlannedSegment[],
  instructionId: string,
  desiredStart: number,
  desiredLane: number,
): InstructionPatch[] {
  const index = segments.findIndex((segment) => segment.instructionId === instructionId)
  if (index < 0) {
    return []
  }

  const segment = segments[index]
  const instruction = route.instructions.find((candidate) => candidate.id === instructionId)
  if (!instruction) {
    return []
  }

  const resolution = route.timingResolution
  const timelineLane = Math.max(0, desiredLane)
  const nextSegment = segments[index + 1]

  if (index === 0) {
    return [{ instructionId, patch: { timelineLane } }]
  }

  const previousSegment = segments[index - 1]
  const previousInstruction = route.instructions.find(
    (candidate) => candidate.id === previousSegment.instructionId,
  )
  if (!previousInstruction) {
    return []
  }

  const minStart = previousSegment.scheduledStart + 0.05
  const maxStart = nextSegment ? nextSegment.scheduledStart : Number.POSITIVE_INFINITY
  const nextStart = clamp(snapTime(desiredStart, resolution), minStart, maxStart)
  const nextEnd = nextStart + segment.duration
  const patches: InstructionPatch[] = [
    {
      instructionId: previousInstruction.id,
      patch: buildRelationPatch(
        nextStart - previousSegment.scheduledEnd,
        resolution,
        previousSegment.duration,
      ),
    },
    {
      instructionId,
      patch: { timelineLane },
    },
  ]

  if (nextSegment) {
    patches[1].patch = {
      ...patches[1].patch,
      ...buildRelationPatch(nextSegment.scheduledStart - nextEnd, resolution, segment.duration),
    }
  }

  return patches
}

export function TimelinePanel() {
  const {
    project,
    activeLayoutId,
    activeRouteId,
    selectedInstructionId,
    playbackTime,
    run,
    selectInstruction,
    jumpToInstruction,
    setPlaybackTime,
    setPlaybackState,
    applyInstructionPatches,
    invertInstruction,
    duplicateInstruction,
    deleteInstruction,
  } = useProjectStore(
    useShallow((state) => ({
      project: state.project,
      activeLayoutId: state.activeLayoutId,
      activeRouteId: state.activeRouteId,
      selectedInstructionId: state.selectedInstructionId,
      playbackTime: state.playbackTime,
      run: state.run,
      selectInstruction: state.selectInstruction,
      jumpToInstruction: state.jumpToInstruction,
      setPlaybackTime: state.setPlaybackTime,
      setPlaybackState: state.setPlaybackState,
      applyInstructionPatches: state.applyInstructionPatches,
      invertInstruction: state.invertInstruction,
      duplicateInstruction: state.duplicateInstruction,
      deleteInstruction: state.deleteInstruction,
    })),
  )

  const activeLayout = getActiveLayout(project, activeLayoutId)
  const activeRoute = getActiveRoute(project, activeRouteId)
  const [previewPatches, setPreviewPatches] = useState<InstructionPatch[] | null>(null)
  const [dragSession, setDragSession] = useState<DragSession | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [timelineZoom, setTimelineZoom] = useState(1)
  const previewPatchesRef = useRef<InstructionPatch[] | null>(null)
  const scrubCanvasRef = useRef<HTMLDivElement | null>(null)
  const scrubActiveRef = useRef(false)
  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * timelineZoom
  const zoomButtonClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] hover:text-white'

  const baseSegments = useMemo(
    () => compileInstructionSequence(activeRoute, activeLayout.spawn),
    [activeLayout.spawn, activeRoute],
  )
  const previewRoute = useMemo(
    () => applyInstructionPatchesToRoute(activeRoute, previewPatches),
    [activeRoute, previewPatches],
  )
  const displaySegments = useMemo(
    () => compileInstructionSequence(previewRoute, activeLayout.spawn),
    [activeLayout.spawn, previewRoute],
  )

  const maxLane = Math.max(...previewRoute.instructions.map((instruction) => instruction.timelineLane ?? 0), 1)
  const laneCount = Math.max(3, maxLane + 2)
  const totalTime = Math.max(
    displaySegments.at(-1)?.scheduledEnd ?? 0,
    (displaySegments.at(-1)?.scheduledEnd ?? 0) + (displaySegments.at(-1)?.delayAfter ?? 0),
    run?.metrics.totalTime ?? 0,
    1,
  )
  const trackWidth = Math.max(1280, totalTime * pixelsPerSecond + EXTRA_TIMELINE_SECONDS * pixelsPerSecond)
  const trackHeight = laneCount * CLIP_LANE_HEIGHT + TRACK_PADDING * 2
  const playheadLeft = TRACK_PADDING + playbackTime * pixelsPerSecond
  const currentRunSegment =
    run?.segments.find(
      (segment) =>
        playbackTime >= segment.startTime && playbackTime <= segment.endTime + segment.delayAfter,
    ) ?? null

  useEffect(() => {
    previewPatchesRef.current = previewPatches
  }, [previewPatches])

  useEffect(() => {
    if (!dragSession) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const deltaSeconds = (event.clientX - dragSession.originClientX) / pixelsPerSecond
      const deltaLanes = Math.round((event.clientY - dragSession.originClientY) / CLIP_LANE_HEIGHT)
      const baseSegment = baseSegments.find((segment) => segment.instructionId === dragSession.instructionId)
      const baseInstruction = activeRoute.instructions.find((instruction) => instruction.id === dragSession.instructionId)
      if (!baseSegment || !baseInstruction) {
        return
      }

      let nextPatches: InstructionPatch[] = []

      if (dragSession.mode === 'move') {
        nextPatches = buildMovePatches(
          activeRoute,
          baseSegments,
          dragSession.instructionId,
          baseSegment.scheduledStart + deltaSeconds,
          (baseInstruction.timelineLane ?? 0) + deltaLanes,
        )
      } else {
        const desiredTime =
          dragSession.mode === 'resize-start'
            ? baseSegment.scheduledStart + deltaSeconds
            : baseSegment.scheduledEnd + deltaSeconds

        nextPatches = buildResizePatches(
          activeRoute,
          baseSegments,
          dragSession.instructionId,
          dragSession.mode,
          desiredTime,
        )
      }

      previewPatchesRef.current = nextPatches.length > 0 ? nextPatches : null
      setPreviewPatches(previewPatchesRef.current)
    }

    const handlePointerUp = () => {
      const committedPatches = previewPatchesRef.current
      if (committedPatches && committedPatches.length > 0) {
        applyInstructionPatches(committedPatches)
      }

      previewPatchesRef.current = null
      setPreviewPatches(null)
      setDragSession(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [activeRoute, applyInstructionPatches, baseSegments, dragSession, pixelsPerSecond])

  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const closeMenu = () => setContextMenu(null)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  useEffect(() => {
    const updateScrubPosition = (clientX: number) => {
      const canvas = scrubCanvasRef.current
      if (!canvas) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      const relativeX = clamp(clientX - rect.left - TRACK_PADDING, 0, Math.max(rect.width - TRACK_PADDING * 2, 0))
      setPlaybackTime(relativeX / pixelsPerSecond)
      setPlaybackState('paused')
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!scrubActiveRef.current) {
        return
      }

      updateScrubPosition(event.clientX)
    }

    const handlePointerUp = () => {
      scrubActiveRef.current = false
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [pixelsPerSecond, setPlaybackState, setPlaybackTime])

  const handleSelectInstruction = (instructionId: string) => {
    selectInstruction(instructionId)
    if (run) {
      jumpToInstruction(instructionId)
    }
    setPlaybackState('paused')
  }

  return (
    <section className="grid min-w-0 gap-5 pb-10 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-white/8 pt-5">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">Timeline</h2>
          <p className="text-sm leading-6 text-slate-500">
            Scrub, slide, stack, or resize events directly on the track. The page is the editor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Route</span>
            <strong className="text-sm text-stone-100">{activeRoute.name}</strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={zoomButtonClass}
              onClick={() => setTimelineZoom((current) => clamp(current - 0.2, 0.6, 2.2))}
            >
              -
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Zoom</span>
              <input
                className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-400"
                type="range"
                min={0.6}
                max={2.2}
                step={0.1}
                value={timelineZoom}
                onChange={(event) => setTimelineZoom(Number(event.target.value))}
              />
            </div>
            <button
              type="button"
              className={zoomButtonClass}
              onClick={() => setTimelineZoom((current) => clamp(current + 0.2, 0.6, 2.2))}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="relative min-w-0 max-w-full overflow-x-auto overflow-y-hidden scrollbar-thin">
        <div
          className="relative cursor-col-resize rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.005)_100%)]"
          ref={scrubCanvasRef}
          style={{ width: `${trackWidth}px`, height: `${trackHeight}px` }}
          onPointerDown={(event) => {
            const target = event.target
            if (!(target instanceof HTMLElement)) {
              return
            }

            if (target.closest('[data-clip-block="true"]')) {
              return
            }

            scrubActiveRef.current = true
            const rect = event.currentTarget.getBoundingClientRect()
            const relativeX = clamp(
              event.clientX - rect.left - TRACK_PADDING,
              0,
              Math.max(rect.width - TRACK_PADDING * 2, 0),
            )
            setPlaybackTime(relativeX / pixelsPerSecond)
            setPlaybackState('paused')
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px)]"
            style={{ backgroundSize: '128px 100%, 32px 100%' }}
          />

          {Array.from({ length: laneCount }, (_, laneIndex) => (
            <div
              key={laneIndex}
              className="pointer-events-none absolute left-0 right-0 border-t border-white/6"
              style={{
                top: `${TRACK_PADDING + laneIndex * CLIP_LANE_HEIGHT}px`,
                height: `${CLIP_LANE_HEIGHT}px`,
              }}
            />
          ))}

          <div
            className="pointer-events-none absolute top-2 bottom-2 z-10 w-0.5 bg-gradient-to-b from-amber-200 to-amber-400 shadow-[0_0_0_1px_rgba(212,165,58,0.16)]"
            style={{ left: `${playheadLeft}px` }}
            aria-hidden
          />

          {displaySegments.map((segment, index) => {
            const instruction = previewRoute.instructions.find((candidate) => candidate.id === segment.instructionId)
            if (!instruction) {
              return null
            }

            const lane = instruction.timelineLane ?? 0
            const isSelected = instruction.id === selectedInstructionId
            const isCurrent = currentRunSegment?.instructionId === instruction.id
            const left = TRACK_PADDING + segment.scheduledStart * pixelsPerSecond
            const top = TRACK_PADDING + lane * CLIP_LANE_HEIGHT + (CLIP_LANE_HEIGHT - CLIP_HEIGHT) * 0.5
            const width = Math.max(
              getMinDuration(activeRoute.timingResolution) * pixelsPerSecond,
              segment.duration * pixelsPerSecond,
            )
            const family = getInstructionFamily(instruction.kind)
            const isRotation = instruction.kind === 'rotateCW' || instruction.kind === 'rotateCCW'
            const familyClass =
              family === 'control' && !isRotation
                ? 'from-blue-400/75 to-blue-900/90'
                : isRotation
                  ? 'from-amber-300/80 to-amber-900/95'
                  : family === 'timed'
                    ? 'from-cyan-300/70 to-cyan-900/95'
                    : 'from-emerald-300/70 to-violet-900/95'

            return (
              <article
                key={instruction.id}
                data-clip-block="true"
                className={`absolute grid grid-cols-[12px_minmax(0,1fr)_12px] items-stretch overflow-hidden rounded-2xl border bg-gradient-to-br shadow-[0_12px_28px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 ${
                  familyClass
                } ${
                  isSelected ? 'border-white/70 shadow-[0_18px_36px_rgba(0,0,0,0.38)]' : 'border-white/10'
                } ${isCurrent ? 'ring-2 ring-amber-300/80 ring-offset-1 ring-offset-transparent' : ''}`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${CLIP_HEIGHT}px`,
                }}
              >
                <button
                  type="button"
                  className="cursor-ew-resize bg-gradient-to-r from-white/35 to-transparent"
                  aria-label={`Resize start for ${formatInstructionLabel(instruction)}`}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    selectInstruction(instruction.id)
                    setDragSession({
                      instructionId: instruction.id,
                      mode: 'resize-start',
                      originClientX: event.clientX,
                      originClientY: event.clientY,
                    })
                  }}
                />

                <button
                  type="button"
                  className="grid min-w-0 content-center gap-1 px-3 py-2 text-left text-white"
                  onClick={() => handleSelectInstruction(instruction.id)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    selectInstruction(instruction.id)
                    setContextMenu({
                      instructionId: instruction.id,
                      x: event.clientX,
                      y: event.clientY,
                    })
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) {
                      return
                    }

                    selectInstruction(instruction.id)
                    setDragSession({
                      instructionId: instruction.id,
                      mode: 'move',
                      originClientX: event.clientX,
                      originClientY: event.clientY,
                    })
                  }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    Event {String(index + 1).padStart(2, '0')}
                  </span>
                  <strong className="truncate text-sm font-semibold">{formatInstructionLabel(instruction)}</strong>
                  <small className="text-xs text-white/75">{instruction.note || 'Edit from Step Settings.'}</small>
                </button>

                <button
                  type="button"
                  className="cursor-ew-resize bg-gradient-to-l from-white/35 to-transparent"
                  aria-label={`Resize end for ${formatInstructionLabel(instruction)}`}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    selectInstruction(instruction.id)
                    setDragSession({
                      instructionId: instruction.id,
                      mode: 'resize-end',
                      originClientX: event.clientX,
                      originClientY: event.clientY,
                    })
                  }}
                />
              </article>
            )
          })}
        </div>
      </div>

      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
        Drag clips to slide or resize. Scroll horizontally to review longer runs.
      </p>

      {contextMenu ? (
        <div
          className="fixed z-50 grid min-w-40 gap-1 rounded-2xl border border-white/10 bg-[#08111d]/96 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              invertInstruction(contextMenu.instructionId)
              setContextMenu(null)
            }}
            disabled={
              !canInvertInstructionKind(
                activeRoute.instructions.find((instruction) => instruction.id === contextMenu.instructionId)?.kind ??
                  'wait',
              )
            }
          >
            Invert
          </button>
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
            onClick={() => {
              duplicateInstruction(contextMenu.instructionId)
              setContextMenu(null)
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-400/10 hover:text-rose-100"
            onClick={() => {
              deleteInstruction(contextMenu.instructionId)
              setContextMenu(null)
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </section>
  )
}
