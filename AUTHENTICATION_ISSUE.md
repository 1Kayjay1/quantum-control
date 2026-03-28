# Authentication System Mismatch - Issue Report

## Problem Summary

The authentication system code expects a Firestore user document structure that doesn't match the actual database structure. This is causing all users to show as "pending approval" even when they should have access.

## Current Firestore Document Structure

The actual user document in Firestore has this structure:
```javascript
{
  accountState: "active",           // string
  createdAt: timestamp,
  displayName: "kjforbers003",
  email: "kjforbers003@gmail.com",
  lastLogin: timestamp,
  lastUpdated: timestamp,
  passwordLastChanged: timestamp,
  role: "instructor",               // string: "student" | "instructor" | "admin"
  status: "active",                 // string
  temporaryPassword: "toolooAL23",
  tierId: "dev_all_access",
  tierLabel: "Developer (All Access)",
  uid: "OIRK9eiBANY7H2ZHn56usujfmZ43",
  updatedAt: timestamp
}
```

## Expected Structure (What Code is Looking For)

The code expects this structure:
```typescript
{
  uid: string
  email: string
  displayName: string
  role: 'student' | 'instructor' | 'admin'
  authenticated: boolean,           // ❌ MISSING - code looks for this
  createdAt: Date
  lastLogin: Date
  teamIds: string[]                 // ❌ MISSING
}
```

## The Mismatch

1. **Missing `authenticated` field**: Code checks `user.authenticated` but the field doesn't exist in Firestore
2. **Missing `teamIds` field**: Code expects this array but it's not in the database
3. **Different field names**: Database uses `accountState` and `status`, code expects `authenticated`

## Files Involved

### 1. Type Definition (`src/types/auth.ts`)
```typescript
export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  authenticated: boolean    // ❌ This field doesn't exist in actual DB
  createdAt: Date
  lastLogin: Date
  teamIds: string[]         // ❌ This field doesn't exist in actual DB
}
```

### 2. Auth Service (`src/services/authService.ts`)
```typescript
async getUserProfile(uid: string): Promise<UserProfile | null> {
  // ...
  return {
    uid,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    authenticated: data.authenticated,  // ❌ Returns undefined because field doesn't exist
    createdAt: data.createdAt?.toDate() || new Date(),
    lastLogin: data.lastLogin?.toDate() || new Date(),
    teamIds: data.teamIds || [],        // ❌ Returns empty array
  }
}
```

### 3. Auth Context (`src/contexts/AuthContext.tsx`)
```typescript
const value: AuthContextType = {
  user,
  loading,
  isAuthenticated: !!user?.authenticated,  // ❌ Always false because authenticated is undefined
  isAdmin: user?.role === 'admin',
  isInstructor: user?.role === 'instructor' || user?.role === 'admin',
  // ...
}
```

### 4. Protected Route (`src/components/auth/ProtectedRoute.tsx`)
```typescript
// Checks isAuthenticated which is always false
if (requireAuth && !isAuthenticated) {
  return <Navigate to="/" replace />  // ❌ Always redirects
}
```

## Solutions (Choose One)

### Option A: Update Code to Match Database
Change the code to use `accountState` and `status` instead of `authenticated`:

```typescript
// In src/types/auth.ts
export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  accountState: string      // Use existing field
  status: string            // Use existing field
  createdAt: Date
  lastLogin: Date
  teamIds?: string[]        // Make optional
  tierId?: string           // Add existing fields
  tierLabel?: string
}

// In src/services/authService.ts
return {
  uid,
  email: data.email,
  displayName: data.displayName,
  role: data.role,
  accountState: data.accountState,
  status: data.status,
  createdAt: data.createdAt?.toDate() || new Date(),
  lastLogin: data.lastLogin?.toDate() || new Date(),
  teamIds: data.teamIds || [],
  tierId: data.tierId,
  tierLabel: data.tierLabel,
}

// In src/contexts/AuthContext.tsx
const value: AuthContextType = {
  user,
  loading,
  isAuthenticated: user?.accountState === 'active' && user?.status === 'active',
  isAdmin: user?.role === 'admin',
  isInstructor: user?.role === 'instructor' || user?.role === 'admin',
  // ...
}
```

### Option B: Add Migration to Update Database
Add `authenticated` field to all existing users:

```typescript
// Migration script
async function migrateUsers() {
  const usersRef = collection(db, 'users')
  const snapshot = await getDocs(usersRef)
  
  for (const doc of snapshot.docs) {
    const data = doc.data()
    await updateDoc(doc.ref, {
      authenticated: data.accountState === 'active' && data.status === 'active',
      teamIds: data.teamIds || []
    })
  }
}
```

### Option C: Update Firestore Rules and Signup/Login
Ensure new users get the `authenticated` field:

```typescript
// In authService.signup()
const userProfile = {
  email: user.email!,
  displayName,
  role: 'student',
  authenticated: isEarlyAccess,  // Add this
  accountState: 'active',        // Keep existing
  status: 'active',              // Keep existing
  createdAt: now,
  lastLogin: now,
  teamIds: [],
}
```

## Current User Issue

The specific user `kjforbers003@gmail.com` has:
- `role: "instructor"` ✅
- `accountState: "active"` ✅
- `status: "active"` ✅
- `authenticated: undefined` ❌ (missing field)

This user should have full access but is being blocked because `authenticated` field is missing.

## Parallax Issue (Separate Problem)

The landing page parallax effects with Three.js are not showing up. The code exists in `src/pages/LandingPage.tsx` but may not be rendering. Possible causes:
1. React Router not showing the landing page at all (routing issue from earlier)
2. Three.js canvas not initializing properly
3. CSS overflow issues preventing scroll effects
4. Build/deployment cache issues

## Recommended Immediate Fix

1. **For authentication**: Update the code to check `accountState === 'active'` instead of `authenticated === true`
2. **For parallax**: Debug why the landing page isn't rendering at the root URL (likely the routing issue mentioned earlier)

## Questions for Debugging

1. When you visit https://quantum-control.web.app, what page do you see?
2. Does the browser console show any errors?
3. Can you access https://quantum-control.web.app/login directly?
4. What happens when you try to access https://quantum-control.web.app/workspace?
