import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { TeamPage } from './pages/TeamPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { AeroPlan } from './components/AeroPlan'
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
