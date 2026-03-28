# Complete React App Redesign - Use Quantum-Visuals Folder

## CRITICAL: Use the files in Quantum-Visuals folder as the EXACT design reference

The Quantum-Visuals folder contains the working HTML files that show the exact design and functionality needed. DO NOT create new designs - use these files as the source of truth:

- `Quantum-Visuals/Landing.html` - Landing page with parallax 3D drone swarm
- `Quantum-Visuals/Workspace.html` - Workspace overview with mission grid
- `Quantum-Visuals/Team.html` - Team workspaces page
- `Quantum-Visuals/login.html` - Login page

## Current Problem

The React app is NOT using the designs from Quantum-Visuals folder. The parallax effects, 3D backgrounds, and page layouts are missing or broken.

## What Needs to Be Done

### 1. Landing Page (Quantum-Visuals/Landing.html → src/pages/LandingPage.tsx)

**Current Issue**: Parallax scroll not working, 3D background not animating properly

**Requirements**:
- Use Three.js with drone swarm (40 drones with octahedron core, rotating rings, engine glow)
- Mouse tracking that rotates the swarm
- Scroll-based parallax: camera moves forward, swarm rotates as user scrolls
- Smooth text reveals with staggered animations
- Glassmorphism navigation with backdrop blur
- Amber accent color (#f59e0b)
- Dark theme (#050505 background)

**Key Code from Landing.html to Copy**:
```javascript
// 3D Background: Drone Swarm
const DRONE_COUNT = 40
const drones = []
const droneGroup = new THREE.Group()

function createDroneMesh() {
  const group = new THREE.Group()
  // Core: OctahedronGeometry(0.1, 0) with wireframe
  // Rings: TorusGeometry(0.2, 0.01) - two rings at 90 degrees
  // Glow: SphereGeometry(0.05) at z=0.1
  return group
}

// Animation loop
function animate() {
  // Mouse follow: droneGroup.rotation.y += 0.05 * (targetX - droneGroup.rotation.y)
  // Parallax scroll: camera.position.z = 5 - scrollProgress * 7
  // Bobbing: drone.position.y = initialPos.y + Math.sin(time + offset) * 0.2
  // Ring spin: ring1.rotation.z += speed
  // Breathing scale: scale = 1 + Math.sin(time * 2 + offset) * 0.1
}
```

### 2. Workspace Page (Quantum-Visuals/Workspace.html → src/pages/WorkspacePage.tsx)

**Current Issue**: No workspace overview page exists

**Requirements**:
- Sidebar with workspace navigation (Personal, Team Alpha, Engineering Dept, Public Library)
- Mission grid showing all missions
- Each mission card has: ID, title, status (draft/published), last modified, duplicate info
- Context menu on each card (Open Simulator, Share, Duplicate, Delete)
- 3D background with animated terrain (Points with sine wave)
- Glassmorphism panels
- Toast notifications

**Key Code from Workspace.html to Copy**:
```javascript
// 3D Background: Digital Terrain
const geometry = new THREE.PlaneGeometry(60, 60, 40, 40)
// Add random height variation
// PointsMaterial with color 0xf59e0b, size 0.05, opacity 0.3
// Animate points: positions.setZ(i, Math.sin(x/2 + t) * 0.5 + Math.cos(y/2 + t) * 0.5)

// Mission cards
function createCard(mission) {
  return `
    <div class="card" onclick="actions.open('${mission.id}')">
      <div class="card-header">
        <span class="card-id">${mission.id}</span>
        <button class="card-menu-btn" onclick="toggleMenu(event, '${mission.id}')">⋮</button>
      </div>
      <div class="card-title">${mission.title}</div>
      <div class="card-meta">Modified ${mission.lastMod}</div>
      <div class="card-tags">
        <span class="tag tag-status ${mission.status}">${mission.status.toUpperCase()}</span>
        ${mission.duplicatedFrom ? `<span class="tag tag-duplicate">Copied from ${mission.duplicatedFrom}</span>` : ''}
      </div>
    </div>
  `
}
```

### 3. Team Page (Quantum-Visuals/Team.html → src/pages/TeamPage.tsx)

**Requirements**:
- Sidebar with navigation (Landing, My Workspace, Team Workspaces)
- Team grid showing teams with icons, descriptions, member counts
- Click team to see missions list
- Mission cards with path visualization (canvas)
- Share modal
- 3D background with neural network (connected nodes)

**Key Code from Team.html to Copy**:
```javascript
// 3D Background: Neural Network
const particleCount = 100
// Points with velocities
// Connect lines if distance < 15
// Parallax: camera.position.x += (mouseX - camera.position.x) * 0.02
```

### 4. Login Page (Quantum-Visuals/login.html → src/pages/LoginPage.tsx)

**Requirements**:
- Glassmorphism login card
- Email/password form
- Google sign-in button
- Amber accent color
- Smooth animations

## Updated Routing (src/App.tsx)

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { TeamPage } from './pages/TeamPage'
import { AeroPlan } from './components/AeroPlan'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Workspace overview */}
          <Route 
            path="/workspace" 
            element={
              <ProtectedRoute requireAuth>
                <WorkspacePage />
              </ProtectedRoute>
            } 
          />
          
          {/* Individual mission (opens AeroPlan) */}
          <Route 
            path="/workspace/:missionId" 
            element={
              <ProtectedRoute requireAuth>
                <AeroPlan />
              </ProtectedRoute>
            } 
          />
          
          {/* Team workspaces */}
          <Route 
            path="/team" 
            element={
              <ProtectedRoute requireAuth>
                <TeamPage />
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

## Design System (from Quantum-Visuals)

**Colors**:
- Background: `#050505`
- Panel: `rgba(21, 25, 34, 0.6)` or `rgba(21, 25, 34, 0.7)`
- Hover: `rgba(30, 38, 48, 0.8)`
- Border: `rgba(255, 255, 255, 0.08)`
- Accent: `#f59e0b` (Amber/Gold)
- Text Main: `#e2e8f0`
- Text Muted: `#718096`

**Typography**:
- UI: Inter
- IDs/Code: JetBrains Mono

**Glassmorphism**:
```css
backdrop-filter: blur(10px);
background: rgba(21, 25, 34, 0.6);
border: 1px solid rgba(255, 255, 255, 0.08);
```

## Deliverables

Please create/update these files:

1. **src/pages/LandingPage.tsx** - Landing page with parallax 3D drone swarm
2. **src/pages/WorkspacePage.tsx** - Workspace overview with mission grid
3. **src/pages/TeamPage.tsx** - Team workspaces page
4. **src/pages/LoginPage.tsx** - Login page (update if needed)
5. **src/pages/SignupPage.tsx** - Signup page (update if needed)
6. **src/App.tsx** - Updated routing
7. **src/components/auth/ProtectedRoute.tsx** - Update if needed

## Important Notes

1. **DO NOT create new designs** - Copy the exact HTML/CSS/JS from Quantum-Visuals folder
2. **DO use Three.js** - The 3D effects are critical
3. **DO use glassmorphism** - The visual style is important
4. **DO keep the amber accent** - #f59e0b is the brand color
5. **DO use Inter and JetBrains Mono fonts**

## Questions for Codex

1. Should I use the exact same Three.js code from the HTML files, or adapt it for React?
2. Should the mission data be hardcoded like in the HTML, or fetched from Firestore?
3. Should the context menu be implemented with a library or custom solution?
4. How should the 3D canvases be sized responsively in React?
