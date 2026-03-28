# Deploying Authentication System

## Prerequisites
1. Firebase project already set up (pshsnjrotc)
2. Firebase CLI installed
3. Node.js and npm installed

## Step 1: Install Dependencies
```bash
npm install
```

This will install react-router-dom which was added to package.json.

## Step 2: Deploy Firestore Security Rules
```bash
firebase deploy --only firestore:rules
```

This deploys the security rules from `firestore.rules` that protect your data.

## Step 3: Update Early Access Date
Edit `src/services/authService.ts` and change this line:
```typescript
const EARLY_ACCESS_CUTOFF = new Date('2024-12-31') // Change to 1 week from now
```

Set it to 1 week from your deployment date. Users who sign up before this date will be auto-approved.

## Step 4: Build and Deploy
```bash
npm run deploy:fresh
```

This will build and deploy your app to Firebase Hosting.

## Step 5: Test the Flow

### Test 1: Early Access Signup
1. Go to https://quantum-control.web.app
2. Click "Get Started" or "Sign In"
3. Click "Create Account"
4. Sign up with a test email
5. You should be automatically authenticated and redirected to workspace

### Test 2: Login
1. Sign out
2. Go to login page
3. Sign in with your test account
4. Should redirect to workspace

### Test 3: Protected Routes
1. Sign out
2. Try to go directly to /workspace
3. Should redirect to /login

### Test 4: After Early Access Period
1. Wait until after the cutoff date OR change the date in code
2. Sign up with a new account
3. Should see "Pending Approval" message
4. Cannot access workspace until admin approves

## Step 6: Create First Admin User

Since you need an admin to approve users after early access, you need to manually set the first admin:

### Option A: Using Firebase Console
1. Go to Firebase Console → Firestore Database
2. Find the `users` collection
3. Find your user document
4. Edit the document:
   - Set `role` to `"admin"`
   - Set `authenticated` to `true`
5. Refresh your app - you now have admin access

### Option B: Using Firebase CLI
```bash
firebase firestore:update users/YOUR_USER_ID --data '{"role":"admin","authenticated":true}'
```

## Security Checklist

- [x] Firestore rules deployed
- [x] Auth required before accessing workspace
- [x] Role-based access control implemented
- [x] Early access period configured
- [x] Protected routes working
- [ ] First admin user created
- [ ] Early access cutoff date set correctly
- [ ] Tested signup flow
- [ ] Tested login flow
- [ ] Tested protected routes

## What's Protected

### Public Access (No Auth Required)
- Landing page (/)
- Login page (/login)
- Signup page (/signup)

### Authenticated Access (Requires Login + Approval)
- Workspace (/workspace)
- All workspace features

### Admin Access (Requires Admin Role)
- Admin panel (/admin) - Coming soon
- User management
- Role assignment
- Approval workflow

## Troubleshooting

### "Permission denied" errors
- Check that Firestore rules are deployed
- Verify user has `authenticated: true` in Firestore
- Check browser console for specific error

### Can't access workspace after login
- Check user document in Firestore
- Verify `authenticated` field is `true`
- Check that early access period hasn't ended

### Infinite redirect loop
- Clear browser cache and cookies
- Check that Firebase Auth is properly initialized
- Verify no conflicting routes

## Next Steps

After basic auth is working:
1. Create admin panel for user management
2. Add team workspace pages
3. Implement workspace/mission CRUD operations
4. Add email verification (optional)
5. Add password reset flow
6. Add rate limiting for login attempts

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Firebase Console → Authentication for user status
3. Check Firestore Database for user documents
4. Verify security rules are deployed correctly
