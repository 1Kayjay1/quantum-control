# Authentication & Authorization Implementation Plan

## Overview
Implementing a secure, role-based authentication system with Firebase for Quantum Control.

## Security Requirements
1. **Early Access Period (1 Week)**
   - Users who sign up get "authenticated" tag
   - Only authenticated users can access the app
   - After 1 week, new signups require admin approval

2. **Role-Based Access Control**
   - `role: "student"` - Default, access to workspace only
   - `role: "instructor"` - Access to workspace + team management
   - `role: "admin"` - Full access including admin panel

3. **Security Measures**
   - Auth check before ANY app content loads
   - Protected routes with redirects
   - Rate limiting on auth endpoints
   - Firestore security rules
   - No client-side secrets
   - XSS protection via React
   - CSRF protection via Firebase

## Architecture

### Firebase Services
- **Authentication**: Email/Password auth
- **Firestore**: User profiles, workspaces, missions
- **Security Rules**: Server-side validation
- **Cloud Functions** (optional): Admin operations

### User Profile Schema
```typescript
{
  uid: string
  email: string
  displayName: string
  role: 'student' | 'instructor' | 'admin'
  authenticated: boolean
  createdAt: timestamp
  lastLogin: timestamp
  teamIds: string[]
}
```

### Collections Structure
```
users/{uid}
  - profile data
  - role
  - authenticated status

workspaces/{workspaceId}
  - name
  - ownerId
  - members: string[]
  - missions: subcollection

teams/{teamId}
  - name
  - members: string[]
  - instructorIds: string[]
```

## Implementation Steps

### Phase 1: Core Auth (Priority 1)
- [x] Firebase config
- [ ] Auth context provider
- [ ] Protected route wrapper
- [ ] Login page (React component from login.html)
- [ ] Signup page with early access logic
- [ ] Auth state persistence
- [ ] Loading states

### Phase 2: Authorization (Priority 1)
- [ ] Role-based route guards
- [ ] Firestore security rules
- [ ] User profile creation on signup
- [ ] Admin approval workflow

### Phase 3: UI Integration (Priority 2)
- [ ] Landing page (React from Landing.html)
- [ ] Workspace page (React from Workspace.html)
- [ ] Team page (React from Team.html)
- [ ] Navigation between pages
- [ ] User menu/logout

### Phase 4: Admin Panel (Priority 2)
- [ ] Admin dashboard
- [ ] User management
- [ ] Approve/reject users
- [ ] Role assignment

### Phase 5: Rate Limiting (Priority 3)
- [ ] Login attempt limiting
- [ ] API rate limiting
- [ ] Firestore quota management

## Files to Create/Modify

### New Files
- `src/contexts/AuthContext.tsx` - Auth state management
- `src/components/auth/ProtectedRoute.tsx` - Route guard
- `src/components/auth/LoginPage.tsx` - Login UI
- `src/components/auth/SignupPage.tsx` - Signup UI
- `src/pages/LandingPage.tsx` - Public landing
- `src/pages/WorkspacePage.tsx` - Main workspace
- `src/pages/TeamPage.tsx` - Team management
- `src/pages/AdminPage.tsx` - Admin panel
- `src/hooks/useAuth.ts` - Auth hook
- `src/services/authService.ts` - Auth operations
- `src/services/userService.ts` - User CRUD
- `firestore.rules` - Security rules
- `firestore.indexes.json` - Query indexes

### Modified Files
- `src/App.tsx` - Add routing and auth
- `src/main.tsx` - Wrap with auth provider
- `src/firebase.ts` - Add Firestore
- `package.json` - Add react-router-dom

## Security Rules Preview

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAuthorized() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.authenticated == true;
    }
    
    function isAdmin() {
      return isAuthorized() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isInstructor() {
      return isAuthorized() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['instructor', 'admin'];
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

## Timeline
- Phase 1: 2-3 hours
- Phase 2: 1-2 hours
- Phase 3: 3-4 hours
- Phase 4: 2-3 hours
- Phase 5: 1 hour

Total: ~10-13 hours of development
