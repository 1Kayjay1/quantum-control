# 🚀 Quick Start - Authentication System

## Deploy in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Deploy Security Rules
```bash
firebase deploy --only firestore:rules
```

### 3. Set Early Access Date
Edit `src/services/authService.ts` line 13:
```typescript
const EARLY_ACCESS_CUTOFF = new Date('2024-12-31') // Change to 1 week from now
```

### 4. Deploy App
```bash
npm run deploy:fresh
```

### 5. Create Admin User
1. Sign up at https://quantum-control.web.app/signup
2. Go to Firebase Console → Firestore
3. Find your user in `users` collection
4. Edit: Set `role` to `"admin"` and `authenticated` to `true`

## Done! 🎉

Your app now has:
- ✅ Secure authentication
- ✅ Protected workspace
- ✅ Role-based access
- ✅ Early access period
- ✅ Landing page as entry point

## Test It

1. **Public Access**: Visit `/` - should see landing page
2. **Protected Access**: Visit `/workspace` - should redirect to login
3. **Login**: Sign in - should access workspace
4. **Signup**: Create account - auto-approved during early access

## Key URLs

- **Landing**: https://quantum-control.web.app/
- **Login**: https://quantum-control.web.app/login
- **Signup**: https://quantum-control.web.app/signup
- **Workspace**: https://quantum-control.web.app/workspace (protected)

## How Users Flow

```
Landing Page (/)
    ↓
Sign Up (/signup) or Login (/login)
    ↓
Workspace (/workspace) - PROTECTED
```

## Early Access Logic

**Before Cutoff Date**: Users auto-approved ✅
**After Cutoff Date**: Users need admin approval ⏳

## Roles

- **student**: Default, workspace access
- **instructor**: + team management
- **admin**: + user management, admin panel

## Security

All data is protected by Firestore security rules. Users can only:
- Read their own profile
- Create/edit their own workspaces
- Access teams they're members of

Admins can manage all users and data.

## Need Help?

See detailed docs:
- `DEPLOY_AUTH.md` - Full deployment guide
- `docs/AUTH_SYSTEM_COMPLETE.md` - Complete system overview
- `docs/AUTH_QUICK_START.md` - Detailed setup instructions

## What's Next?

After auth is working:
1. Test with real users
2. Create admin panel (optional)
3. Add team pages (optional)
4. Add workspace CRUD (optional)

The core protection is already in place! 🔒
