# Quantum Control - Project Roadmap

## Phase 1: Core Editor Improvements (CURRENT - Implement Now)

### 1.1 Object Management
- [x] Hover + Delete key to remove objects
- [x] Ctrl+Click drone to set spawn point mode
- [x] Ctrl+Click ground to place new spawn point
- [x] Visual indicator for spawn point placement mode

### 1.2 Camera Controls
- [x] 'C' key to focus camera on drone
- [x] Middle mouse drag up/down for vertical camera movement
- [x] Smooth camera transitions

### 1.3 Measurement Tool
- [x] 'F' key to activate measurement mode
- [x] Click two objects to measure distance
- [x] Display distance in feet and inches
- [x] Visual line between measured objects
- [x] Clear measurement on ESC or new measurement

### 1.4 Settings Panel
- [x] Expandable settings drawer (gear icon in header)
- [x] Unit system toggle (Imperial/Metric)
- [x] Keyboard shortcuts reference
- [x] Search functionality for settings
- [x] Persistent settings (localStorage)

### 1.5 Smart Object Spawning
- [x] Objects spawn near camera position
- [x] Objects spawn on ground plane at camera look-at point
- [x] Avoid spawning inside other objects

### 1.6 Auto-Save
- [x] Auto-save course changes every 30 seconds
- [x] Save indicator in UI
- [x] Manual save button

---

## Phase 2: Workspace & Authentication (Next Sprint)

### 2.1 Firebase Authentication
- [ ] Sign up / Sign in UI
- [ ] Email/password authentication
- [ ] Google OAuth integration
- [ ] User profile management
- [ ] Password reset flow

### 2.2 Workspace System
- [ ] Create/delete workspaces
- [ ] Workspace list view
- [ ] Workspace switching
- [ ] Workspace sharing (view/edit permissions)
- [ ] Workspace settings

### 2.3 Route Management
- [ ] Save routes to specific workspaces
- [ ] Route versioning
- [ ] Route duplication
- [ ] Route templates
- [ ] Route search and filtering

### 2.4 Home Page
- [ ] Dashboard with recent workspaces
- [ ] Quick actions (new route, open workspace)
- [ ] Activity feed
- [ ] Workspace cards with previews

---

## Phase 3: Export & Hardware Integration (Future)

### 3.1 Python Export
- [ ] Generate Python code from route
- [ ] DJI Tello SDK format
- [ ] Custom drone SDK support
- [ ] Export settings (speed, precision, etc.)
- [ ] Code preview before export
- [ ] Download as .py file

### 3.2 Controller Integration
- [ ] Detect connected controllers
- [ ] Controller mapping UI
- [ ] Live flight recording
- [ ] Record → Route conversion
- [ ] Controller calibration
- [ ] Multiple controller profiles

### 3.3 Live Recording & Tweaking
- [ ] Start/stop recording
- [ ] Real-time position tracking
- [ ] Convert recording to instructions
- [ ] Tweak recorded route
- [ ] Compare recorded vs planned
- [ ] Replay recorded flights

---

## Phase 4: Advanced Features (Long-term)

### 4.1 Collaboration
- [ ] Real-time multi-user editing
- [ ] Comments on routes
- [ ] Route review/approval workflow
- [ ] Team workspaces

### 4.2 Analytics
- [ ] Route performance metrics
- [ ] Success rate tracking
- [ ] Optimization suggestions
- [ ] Historical data visualization

### 4.3 Competition Mode
- [ ] Official competition templates
- [ ] Scoring system
- [ ] Leaderboards
- [ ] Competition replay

### 4.4 Advanced Physics
- [ ] Wind simulation
- [ ] Battery drain modeling
- [ ] Prop wash effects
- [ ] Obstacle collision prediction

---

## Technical Debt & Improvements

### Code Quality
- [ ] Add comprehensive unit tests
- [ ] E2E testing with Playwright
- [ ] Performance profiling
- [ ] Code splitting for faster loads
- [ ] Error boundary implementation

### Documentation
- [ ] User guide
- [ ] API documentation
- [ ] Video tutorials
- [ ] FAQ section

### Accessibility
- [ ] Keyboard navigation for all features
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] Reduced motion mode

---

## Current Sprint Tasks (Implement Now)

1. ✅ Delete object on hover + Del key
2. ✅ Ctrl+Click spawn point placement
3. ✅ 'C' key camera focus on drone
4. ✅ Middle mouse vertical camera movement
5. ✅ 'F' key measurement tool
6. ✅ Settings panel with unit toggle
7. ✅ Keyboard shortcuts reference
8. ✅ Smart object spawning near camera
9. ✅ Auto-save system

## Dependencies

- Firebase SDK (Phase 2)
- Python code generator library (Phase 3)
- WebUSB/WebHID for controllers (Phase 3)
- WebRTC for collaboration (Phase 4)

## Timeline Estimate

- Phase 1: 1 week (CURRENT)
- Phase 2: 2-3 weeks
- Phase 3: 3-4 weeks
- Phase 4: Ongoing

---

Last Updated: 2026-03-27
