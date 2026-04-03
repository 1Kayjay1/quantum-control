import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { TeamPage } from './pages/TeamPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { AeroPlan } from './components/AeroPlan'
import { GhostlineLandingPage } from './pages/GhostlineLandingPage'
import { GhostlineWorkspaceBrowserPage } from './pages/GhostlineWorkspaceBrowserPage'
import { GhostlineSessionBrowserPage } from './pages/GhostlineSessionBrowserPage'
import { GhostlineWorkspacePage } from './pages/GhostlineWorkspacePage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Protected routes - require authentication */}
          <Route 
            path="/workspace" 
            element={
              <ProtectedRoute requireAuth>
                <WorkspacePage />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/workspace/:missionId" 
            element={
              <ProtectedRoute requireAuth>
                <AeroPlan />
              </ProtectedRoute>
            } 
          />

          <Route
            path="/team"
            element={
              <ProtectedRoute requireAuth>
                <TeamPage />
              </ProtectedRoute>
            }
          />

          {/* Ghostline routes - CoDrone EDU Route Optimizer */}
          <Route path="/ghostline" element={<GhostlineLandingPage />} />
          <Route 
            path="/ghostline/workspace" 
            element={
              <ProtectedRoute requireAuth>
                <GhostlineWorkspaceBrowserPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/ghostline/workspace/:workspaceId" 
            element={
              <ProtectedRoute requireAuth>
                <GhostlineSessionBrowserPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/ghostline/session/:sessionId" 
            element={
              <ProtectedRoute requireAuth>
                <GhostlineWorkspacePage />
              </ProtectedRoute>
            } 
          />
          
          {/* Redirect /editor to /workspace for backwards compatibility */}
          <Route path="/editor" element={<Navigate to="/workspace" replace />} />
          
          {/* Catch all - redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
