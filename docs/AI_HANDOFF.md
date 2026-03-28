# Quantum Control AI Handoff

Last updated: 2026-03-27

This file is the cross-chat source of truth for the current state of Quantum Control. Any AI picking up this repo should read this file first, then optionally read `public/ai-context.json` for the same information in machine-friendly form.

## Project Purpose

Quantum Control is a browser-based route-planning and simulation workspace for autonomous student drone challenge prep.

Core product goals:
- rebuild the field in 3D
- author route instructions manually
- simulate realistic-but-stable route execution
- review replay, deviation, collisions, and checkpoints
- export manual-only route sheets

Non-goals:
- no direct hardware control
- no executable drone code generation
- no automatic upload to official competition software

## Current Architecture

Main app stack:
- React + TypeScript + Vite
- React Three Fiber / Three.js for viewport rendering
- Zustand for app state
- Dexie / IndexedDB for persistence
- Cannon-based hybrid physics in the simulation layer

Core code areas:
- `src/core/types.ts`: project, route, field, sim, checkpoint, replay data model
- `src/core/constants.ts`: physical constants, mission dimensions, defaults
- `src/core/math.ts`: geometry helpers, collision/support math
- `src/core/presets.ts`: instruction and object libraries
- `src/core/sampleProject.ts`: starter project data and behavior presets
- `src/core/simulation/compile.ts`: instruction -> planned segment compiler
- `src/core/simulation/simulate.ts`: main hybrid sim, replay trace, collisions, checkpoints, analysis prep
- `src/core/simulation/analysis.ts`: replay interpolation, comparison, metrics helpers
- `src/store/projectStore.ts`: orchestration, persistence, playback, run execution
- `src/components/FieldViewport.tsx`: real viewport, overlays, object interaction
- `src/components/TimelinePanel.tsx`: route timeline / sequencer UI
- `src/components/TopBar.tsx`, `LeftRail.tsx`, `RightDrawer.tsx`, `Viewport.tsx`, `Timeline.tsx`: main shell/layout

## What Is Implemented

Simulation and replay:
- deterministic seeded simulation
- compile -> simulate -> analyze -> replay pipeline
- planned path plus actual path hybrid execution
- replay traces with scrub/playback
- deep analysis / Monte Carlo style confidence runs

Physics and behavior:
- gravity
- drag
- drift
- gusts
- ground effect
- dirty-air / descent disturbance
- carry / coasting after movement release
- reduced but still present reference assist
- hybrid controller-driven motion rather than full rotor-by-rotor free-body flight

Collision system:
- stable physics collider for the drone
- more accurate scoring/debug collision proxy
- deduped collision events
- collision severity classification
- representative contact points and normals
- improved post-impact path disruption without full spin chaos

Mission system:
- mission-style field objects
- ordered checkpoints
- skipped / out-of-order invalidation
- deterministic color mat detection
- landing result classification
- invalid landing when required checkpoints are incomplete

UI/workspace:
- editor + scene workspace modes
- timeline dock states in scene mode
- object selection and direct manipulation in the viewport
- separate working entry page at `prototype-a.html`
- static layout mock page at `public/vanilla-prototypes/index.html`

## Current UI State

The real app shell has been pushed toward a flatter Mission Control layout.

Current intent:
- top bar is thinner and collapsible
- left and right columns scroll independently
- center viewport stays visually dominant
- timeline docks under the viewport
- Prototype A / Mission Control Balanced is the preferred direction

Important distinction:
- `prototype-a.html` uses the real app with the live 3D viewport and real functionality
- `public/vanilla-prototypes/index.html` is only a static visual mock and does not contain real Three.js / sim behavior

## What Is Still Incomplete / Messy

UI:
- layout chrome still needs cleanup and consistency passes
- some side-panel content is still too nested / too verbose
- top bar can still be reduced further
- Control Center and Simulation Summary still need flattening for the chosen shell

Physics:
- still not a full rotor-by-rotor quadcopter model
- still uses yaw-bounded stabilization instead of full free rotational dynamics
- actual path is less rail-guided than before, but still hybrid and assisted by design

Collision:
- proxy accuracy is better, but still approximate
- not a full triangle-mesh live physics collider

Timeline:
- functional and improved, but still not a perfect control sequencer
- further cleanup of semantics and density would help

## Recent Major Changes

Recent work completed before this handoff:
- improved variation so different seeds produce meaningfully different runs
- reduced over-anchoring to planned path
- actual pass now resolves using actual heading
- carry / cutting behavior improved
- collision event deduping and severity
- representative collision contact points
- mission enforcement and landing invalidation
- UI shell restructuring toward a cleaner workstation layout
- separate real-app entry for Prototype A via `prototype-a.html`

## Recommended Next Steps

If continuing from here, safest order:

1. UI cleanup only
- flatten remaining side-panel chrome
- shrink top bar further
- simplify inspector density
- keep viewport and timeline as dominant surfaces

2. Timeline refinement
- reduce visual noise
- improve lane semantics
- tighten selected / disabled / overlap styling

3. Physics polish
- only after UI settles
- small realism gains, not architecture rewrites

## Validation Commands

Use these after changes:

```bash
npm run lint
npm run test:run
npm run build
```

## Important Paths

Primary app entry:
- `index.html`

Separate real Prototype A entry:
- `prototype-a.html`

Static mock-only prototype page:
- `public/vanilla-prototypes/index.html`

Machine-readable handoff:
- `public/ai-context.json`

Human-readable handoff:
- `docs/AI_HANDOFF.md`
