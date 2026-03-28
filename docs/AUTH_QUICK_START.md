# Quantum Control - Authentication Quick Start Guide

## What We're Building

A complete authentication system with:
- Firebase Auth (email/password)
- Role-based access control (student/instructor/admin)
- Early access period (1 week authenticated tag)
- Protected routes
- Admin panel for user management
- Firestore security rules
- Rate limiting

## Installation Steps

### 1. Install Dependencies
```bash
npm install react-router-dom
```

### 2. Update Firebase Config
The firebase.ts file needs to add Auth and Firestore:

```typescript
// src/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyD8wHGPtA7DPpySPamomF_JTRgzjCQ5sl8',
  authDomain: 'pshsnjrotc.firebaseapp.com',
  projectId: 'pshsnjrotc',
  storageBucket: 'pshsnjrotc.firebasestorage.app',
  messagingSenderId: '492584636829',
  appId: '1:492584636829:web:7e02b00d1f27c299859f74',
  measurementId: 'G-TVL0Q0QCK9',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export let analytics: ReturnType<typeof getAnalytics> | undefined

isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app)
    }
  })
  .catch(() => {
    // Analytics is optional
  })
```

### 3. Create Firestore Security Rules

Create `firestore.rules` in project root:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isAuthorized() {
      return isAuthenticated() && getUserData().authenticated == true;
    }
    
    function isAdmin() {
      return isAuthorized() && getUserData().role == 'admin';
    }
    
    function isInstructor() {
      return isAuthorized() && getUserData().role in ['instructor', 'admin'];
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && (request.auth.uid == userId || isInstructor());
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }
    
    // Workspaces
    match /workspaces/{workspaceId} {
      allow read: if isAuthorized() && 
                     (resource.data.ownerId == request.auth.uid || 
                      request.auth.uid in resource.data.members);
      allow create: if isAuthorized();
      allow update, delete: if isAuthorized() && resource.data.ownerId == request.auth.uid;
      
      match /missions/{missionId} {
        allow read, write: if isAuthorized() && 
                              (get(/databases/$(database)/documents/workspaces/$(workspaceId)).data.ownerId == request.auth.uid ||
                               request.auth.uid in get(/databases/$(database)/documents/workspaces/$(workspaceId)).data.members);
      }
    }
    
    // Teams
    match /teams/{teamId} {
      allow read: if isAuthorized() && request.auth.uid in resource.data.members;
      allow create: if isInstructor();
      allow update, delete: if isInstructor() && request.auth.uid in resource.data.instructorIds;
    }
  }
}
```

### 4. Deploy Security Rules
```bash
firebase deploy --only firestore:rules
```

## File Structure

```
src/
├── contexts/
│   └── AuthContext.tsx          # Auth state management
├── components/
│   ├── auth/
│   │   ├── ProtectedRoute.tsx   # Route guard
│   │   ├── LoginPage.tsx        # Login UI
│   │   └── SignupPage.tsx       # Signup UI
│   └── layout/
│       └── Navigation.tsx       # Nav with auth
├── pages/
│   ├── LandingPage.tsx          # Public landing
│   ├── WorkspacePage.tsx        # Main workspace
│   ├── TeamPage.tsx             # Team management
│   └── AdminPage.tsx            # Admin panel
├── services/
│   ├── authService.ts           # Auth operations
│   └── userService.ts           # User CRUD
├── hooks/
│   └── useAuth.ts               # Auth hook
└── types/
    └── auth.ts                  # TypeScript types
```

## Key Concepts

### 1. Early Access Logic
```typescript
// When user signs up
const EARLY_ACCESS_CUTOFF = new Date('2024-02-07') // 1 week from now
const isEarlyAccess = new Date() < EARLY_ACCESS_CUTOFF

await setDoc(doc(db, 'users', user.uid), {
  authenticated: isEarlyAccess, // Auto-approve during early access
  role: 'student',
  // ... other fields
})
```

### 2. Protected Routes
```typescript
<ProtectedRoute requireAuth requireRole="admin">
  <AdminPage />
</ProtectedRoute>
```

### 3. Auth Context
```typescript
const { user, loading, isAuthenticated, isAdmin, logout } = useAuth()
```

## Next Steps

1. Run `npm install` to get react-router-dom
2. I'll create all the necessary files in the next response
3. Update App.tsx with routing
4. Test authentication flow
5. Deploy security rules

## Security Checklist

- [ ] Firestore rules deployed
- [ ] Auth state checked before render
- [ ] No sensitive data in client code
- [ ] Rate limiting on login (Firebase handles this)
- [ ] HTTPS only (Firebase hosting does this)
- [ ] Input validation on all forms
- [ ] XSS protection (React handles this)
- [ ] CSRF protection (Firebase handles this)

## Admin Panel Features

- View all users
- Approve/reject pending users
- Change user roles
- Delete users
- View system stats

## Testing

1. Sign up during early access → Should be auto-approved
2. Sign up after early access → Should need approval
3. Try accessing workspace without auth → Should redirect to login
4. Try accessing admin panel as student → Should show "Access Denied"
5. Admin approves user → User can now access app

Ready to implement? Let me know and I'll create all the files!
