# Ghostline - CoDrone EDU Route Optimizer

A deterministic, iterative optimizer for CoDrone EDU autonomous routes. Start from a human-taught baseline and keep refining the champion.

## Architecture

Ghostline is a completely isolated feature area within the Quantum Control repository:

- **Separate routes**: `/ghostline/*`
- **Separate state**: `src/ghostline/store.ts`
- **Separate services**: `src/ghostline/services/`
- **Separate domain models**: `src/ghostline/types.ts`
- **Separate Firebase collections**: `ghostline_*`

## Data Hierarchy

```
Ghostline Workspaces (personal + team)
└── Workspace
    └── Sessions (progression areas)
        ├── Overview (stats)
        ├── Teach Mode (record baseline)
        ├── Checkpoints (define validation points)
        ├── Replay (execute baseline)
        ├── Optimize (iterative refinement)
        ├── History (run logs)
        └── Settings (configuration)
```

## Navigation Flow

1. User lands on `/ghostline` (landing page)
2. Click "Open Workspace" → `/ghostline/workspace` (workspace browser)
3. Select a workspace → `/ghostline/workspace/:workspaceId` (session browser)
4. Select a session → `/ghostline/session/:sessionId` (main workspace with sidebar)
5. Use sidebar to navigate between Overview, Teach Mode, Checkpoints, etc.

## Firebase Collections

- `ghostline_workspaces` - Workspace metadata
- `ghostline_sessions` - Session metadata and stats
- `ghostline_checkpoints` - Checkpoint definitions per session
- `ghostline_runs` - Run records (telemetry, replay frames, results)
- `ghostline_configs` - Optimizer configuration per session

## Key Features

- **Teach Mode**: Record manual flight with full telemetry capture
- **Checkpoint System**: Define validation points with tolerances
- **Replay Engine**: Execute recorded routes autonomously
- **Iterative Optimizer**: Bounded mutations to improve time while maintaining validity
- **Elite Memory**: Persist best runs, elite pool, and optimizer state
- **Safety Layer**: Real-time monitoring and abort conditions
- **Obsessive Logging**: Every run, every checkpoint, every abort reason

## Development Status

Currently implemented:
- ✅ Workspace and session management
- ✅ Firebase integration
- ✅ UI navigation flow
- ✅ Data models and types
- ✅ Zustand store with persistence

To be implemented:
- ⏳ CoDrone SDK wrapper
- ⏳ Teach mode recording
- ⏳ Checkpoint creation and editing
- ⏳ Replay engine
- ⏳ Optimization algorithms
- ⏳ Safety monitoring
- ⏳ Telemetry visualization

## Tech Stack

- React + TypeScript
- Zustand (state management)
- Firebase Firestore (persistence)
- Three.js (landing page visuals)
- React Router (navigation)

## Color Palette

Ghostline uses a distinct cyan/teal palette to differentiate from Quantum Control's amber:

- Primary: `#06b6d4` (cyan-500)
- Secondary: `#0891b2` (cyan-600)
- Accent: `#22d3ee` (cyan-400)
- Background: `#020408` (dark blue-black)
