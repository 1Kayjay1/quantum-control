# Quantum Control

**The Future of Autonomous Flight**

Quantum Control is a browser-based 3D route-planning and simulation workspace for student autonomous drone challenge prep. It helps teams rebuild the field, test route ideas, simulate realistic drift and timing imperfections, compare route variants, and collaborate on mission design.

## 🚀 Quick Start

### For Users
1. Visit [quantum-control.web.app](https://quantum-control.web.app)
2. Sign up for an account (auto-approved during early access)
3. Start designing drone missions in the workspace!

### For Developers
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build and deploy
npm run deploy:fresh
```

## 🔐 Authentication System

Quantum Control includes a complete authentication system:

- **Secure Login/Signup**: Firebase Authentication with email/password
- **Role-Based Access**: Student, Instructor, and Admin roles
- **Protected Workspace**: Only authenticated users can access the editor
- **Early Access Period**: Auto-approve users during first week
- **Firestore Security**: Comprehensive security rules protect all data

**Setup Instructions**: See [QUICK_START_AUTH.md](QUICK_START_AUTH.md)

## ✨ Features

### Flight Simulation
- Real-time physics engine with wind, drag, and inertia
- Custom drone models (GLB support)
- Timeline-based mission sequencer (CapCut-style editing)
- 13 official autonomous course objects with accurate dimensions
- Precision measurement tools (feet/inches and meters)

### Workspace Editor
- 3D viewport with orbit controls
- Drag-and-drop object placement
- Grid snapping (40cm grid)
- Object manipulation with arrow keys
- Undo/redo system (Ctrl+Z/Ctrl+Y)
- Keyboard shortcuts for efficiency
- Spawn point placement
- Camera focus tools

### Mission Planning
- Visual instruction timeline
- Draggable instruction blocks
- Resize handles for duration adjustment
- Instruction stacking and overlap
- Real-time physics preview
- Playback controls with speed adjustment

### Collaboration (Coming Soon)
- Team workspaces
- Mission sharing
- Instructor-led courses
- Mission templates library

## 🎯 Use Cases

- **Education**: Teach autonomous flight concepts with visual feedback
- **Competition**: Design and test competition routes before field day
- **Research**: Prototype and validate flight algorithms
- **Training**: Practice drone piloting in a safe simulation environment

## 📚 Documentation

- **[QUICK_START_AUTH.md](QUICK_START_AUTH.md)** - Deploy authentication in 5 minutes
- **[DEPLOY_AUTH.md](DEPLOY_AUTH.md)** - Detailed deployment guide
- **[docs/AUTH_SYSTEM_COMPLETE.md](docs/AUTH_SYSTEM_COMPLETE.md)** - Complete auth overview
- **[docs/PROJECT_ROADMAP.md](docs/PROJECT_ROADMAP.md)** - Future features and timeline
- **[docs/PHASE1_IMPLEMENTATION.md](docs/PHASE1_IMPLEMENTATION.md)** - Core features documentation
- **[docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)** - Project context for AI assistants

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **3D Graphics**: Three.js with custom controls
- **Physics**: Custom physics engine with Cannon.js integration
- **State Management**: Zustand with undo/redo
- **Local Storage**: Dexie (IndexedDB)
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Hosting**: Firebase Hosting
- **Styling**: Tailwind CSS + custom dark theme

## 🔒 Security

- Firestore security rules protect all data
- Authentication required before accessing workspace
- Role-based access control (RBAC)
- No sensitive data exposed to client
- Rate limiting on authentication endpoints (Firebase managed)
- XSS protection (React)
- CSRF protection (Firebase)

## 📦 Project Structure

```
src/
├── components/
│   ├── auth/              # Authentication components
│   │   └── ProtectedRoute.tsx
│   ├── AeroPlan.tsx       # Main workspace editor
│   └── ...                # Other UI components
├── contexts/
│   └── AuthContext.tsx    # Authentication state management
├── services/
│   └── authService.ts     # Auth operations (login, signup, etc.)
├── pages/
│   ├── LandingPage.tsx    # Public landing page
│   ├── LoginPage.tsx      # Login UI
│   ├── SignupPage.tsx     # Signup UI
│   └── ...                # Other pages
├── core/
│   ├── simulation/        # Physics engine
│   ├── constants.ts       # Field dimensions and constants
│   └── presets.ts         # Course object definitions
├── store/
│   └── projectStore.ts    # Zustand state management
└── types/
    └── auth.ts            # TypeScript type definitions

firestore.rules            # Firestore security rules
firebase.json              # Firebase configuration
```

## 🚀 Deployment

```bash
# Install dependencies
npm install

# Deploy Firestore security rules
firebase deploy --only firestore:rules

# Build and deploy everything
npm run deploy:fresh

# Or deploy specific services
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

## 🧪 Testing

```bash
# Run linter
npm run lint

# Run tests
npm run test:run

# Build for production
npm run build

# Preview production build locally
npm run preview:host
```

## 🎮 Keyboard Shortcuts

- **Ctrl+Z** - Undo
- **Ctrl+Y** - Redo
- **C** - Focus camera on drone
- **F** - Measurement mode (select object first)
- **Del** - Delete hovered/selected object
- **Shift** - Toggle grid snap
- **↑/↓** - Adjust object height
- **G/R/S** - Transform gizmo modes (translate/rotate/scale)
- **Ctrl+Click** - Set spawn point
- **Double-Click** - Follow mode
- **ESC** - Exit modes

## 🔧 Configuration

### Early Access Period
Edit `src/services/authService.ts`:
```typescript
const EARLY_ACCESS_CUTOFF = new Date('2024-12-31') // Set to 1 week from deployment
```

### Firebase Config
Already configured in `src/firebase.ts` - no changes needed unless using a different Firebase project.

## 🤝 Contributing

This is a private project for PSHS NJROTC. For questions or issues, contact the development team.

## 📋 Guardrails

- No direct drone hardware connection or control
- No executable drone code generation
- No direct export into official competition platform
- Manual, human-readable output only
- All data stored locally and in user's Firebase account

## 📄 License

Proprietary - All rights reserved

## 🎓 Credits

Built for PSHS NJROTC autonomous drone program.

---

**Live Site**: [quantum-control.web.app](https://quantum-control.web.app)  
**Status**: ✅ Production Ready with Full Authentication  
**Version**: 2.0.0 (Auth System Complete)
