# Workspace Architecture Redesign - Detailed Prompt for Codex

## Current Problem

The current application has a broken routing structure:

1. **Current Behavior**: 
   - `/workspace` route shows the AeroPlan editor (the "little editor thing")
   - There's NO workspace overview page that shows missions
   - Users are taken directly to the editor when they should see a mission list first

2. **Expected Behavior** (based on Quantum-Visuals/Workspace.html):
   - `/workspace` should show a **workspace overview page** with a list of missions
   - Clicking on a mission should open the **AeroPlan editor** (the flight simulator)R
   - There should be a sidebar with workspace navigation (Personal, Team Alpha, etc.)
   - Each workspace shows its missions in a grid

## Current Files

### src/App.tsx (Current Routing)
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { AeroPlan } from './components/AeroPlan'  // This is the editor

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* PROBLEM: This shows the editor directly */}
          <Route 
            path="/workspace" 
            element={
              <ProtectedRoute requireAuth>
                <AeroPlan />
              </ProtectedRoute>
            } 
          />
          
          <Route path="/editor" element={<Navigate to="/workspace" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

### src/components/AeroPlan.tsx
- This is the flight simulator/editor component
- Shows the 3D viewport, timeline, mission builder
- Should only be accessible when clicking on a specific mission

### Quantum-Visuals/Workspace.html (Reference Design)
This file shows the desired workspace page structure:
- Sidebar with workspace navigation
- Mission grid showing all missions
- Each mission card has: ID, title, status (draft/published), last modified, duplicate info
- Context menu on each card (Open Simulator, Share, Duplicate, Delete)
- 3D background with animated terrain

## What Needs to Be Created

### 1. New Workspace Overview Page (`src/pages/WorkspacePage.tsx`)

This page should:
- Show a sidebar with workspace navigation
- Display missions in a grid
- Allow filtering by workspace
- Show mission cards with all metadata
- Have context menu for each mission
- Link to AeroPlan when clicking on a mission

**Key Features:**
- Sidebar with workspace list (Personal, Team Alpha, Engineering Dept, Public Library)
- Mission grid with cards showing:
  - Mission ID (e.g., "QS-1024")
  - Mission title
  - Status tag (DRAFT, PUBLISHED)
  - Last modified time
  - Duplicate source if applicable
- Context menu with actions:
  - "Open Simulator" → Navigate to `/workspace/:missionId` (AeroPlan)
  - "Share to Team"
  - "Duplicate"
  - "Delete"
- Toast notifications for actions

### 2. Updated Routing (`src/App.tsx`)

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { WorkspacePage } from './pages/WorkspacePage'  // NEW
import { AeroPlan } from './components/AeroPlan'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* NEW: Workspace overview page */}
          <Route 
            path="/workspace" 
            element={
              <ProtectedRoute requireAuth>
                <WorkspacePage />
              </ProtectedRoute>
            } 
          />
          
          {/* NEW: Individual mission route (opens AeroPlan) */}
          <Route 
            path="/workspace/:missionId" 
            element={
              <ProtectedRoute requireAuth>
                <AeroPlan />
              </ProtectedRoute>
            } 
          />
          
          <Route path="/editor" element={<Navigate to="/workspace" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

### 3. Mission Data Structure

The workspace should fetch missions from Firestore. Here's the expected structure:

```typescript
// src/types/mission.ts
export interface Mission {
  id: string
  title: string
  workspaceId: string
  ownerId: string
  status: 'draft' | 'published'
  lastModified: Date
  duplicatedFrom?: string
  data: any  // The actual mission configuration
  createdAt: Date
  members?: string[]  // User IDs who can access
}
```

### 4. Workspace Data Structure

```typescript
// src/types/workspace.ts
export interface Workspace {
  id: string
  name: string
  ownerId: string
  members: string[]
  createdAt: Date
  updatedAt: Date
}
```

## Implementation Steps

### Step 1: Create Mission and Workspace Types
Create `src/types/mission.ts` and `src/types/workspace.ts` with the interfaces above.

### Step 2: Create Workspace Service
Create `src/services/workspaceService.ts` with functions:
- `getWorkspaces()` - Get all workspaces for current user
- `getMissions(workspaceId)` - Get missions for a workspace
- `createMission(workspaceId, title)` - Create new mission
- `updateMission(missionId, data)` - Update mission
- `deleteMission(missionId)` - Delete mission
- `duplicateMission(missionId)` - Duplicate mission

### Step 3: Create Workspace Page Component
Create `src/pages/WorkspacePage.tsx` with:
- Sidebar component with workspace navigation
- Mission grid component
- Context menu component
- Toast notification system
- 3D background (similar to Quantum-Visuals/Workspace.html)

### Step 4: Update AeroPlan to Accept Mission ID
Modify `AeroPlan` component to:
- Accept `missionId` as a prop or route parameter
- Load the specific mission data
- Initialize the editor with that mission

### Step 5: Update ProtectedRoute
Update `ProtectedRoute.tsx` to handle workspace routes properly.

## Design Requirements

### Visual Style (from Quantum-Visuals/Workspace.html)
- Dark theme: `#050505` background
- Glassmorphism: `rgba(21, 25, 34, 0.6)` panels
- Amber accent: `#f59e0b`
- Border: `rgba(255, 255, 255, 0.08)`
- Text: `#e2e8f0` main, `#718096` muted
- Font: Inter for UI, JetBrains Mono for IDs

### Sidebar Navigation
```
QUANTUM (logo)
├── Main
│   ├── Landing (link to /)
│   ├── Workspace (current page)
│   └── Team (link to /team)
└── Your Workspaces
    ├── Personal Workspace
    ├── Team Alpha
    ├── Engineering Dept
    └── Public Library
```

### Mission Card Layout
```
┌─────────────────────────────────────┐
│ QS-1024                    ⋮        │
├─────────────────────────────────────┤
│ Basic Flight Test                   │
│ ⏰ Modified 2h ago                  │
│ [PUBLISHED] [Copied from... ]       │
└─────────────────────────────────────┘
```

## Questions for Codex

1. Should missions be stored in Firestore as a subcollection under workspaces, or as a separate collection with workspaceId reference?

2. How should the context menu be implemented? Should it use a library like `react-contextmenu` or a custom solution?

3. Should the 3D background be Three.js (like the reference) or a simpler CSS animation?

4. How should mission data be stored? Should it be a JSON blob in Firestore or normalized across multiple collections?

5. Should there be a "New Mission" button that creates a blank mission, or should it duplicate a template?

6. How should workspace permissions work? Should users be able to join teams, or only be added by owners?

## Deliverables

Please create:
1. `src/types/mission.ts` - Mission type definitions
2. `src/types/workspace.ts` - Workspace type definitions  
3. `src/services/workspaceService.ts` - Firestore operations
4. `src/pages/WorkspacePage.tsx` - Workspace overview page
5. Updated `src/App.tsx` - New routing
6. Updated `src/components/auth/ProtectedRoute.tsx` - If needed

The AeroPlan component should remain mostly unchanged, just need to add mission ID loading.
