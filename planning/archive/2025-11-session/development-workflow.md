# Development Workflow Strategy

## Current Status: Fast Iteration on Production (Phase 1)

**Decision Date:** 2025-11-03
**Active Until:** Google Play publishing complete (Phase 4)

### Why We Work Directly on Production Now

**Rationale:**
- 🎓 **Educational project** - Low risk, learning-focused
- 👤 **Single developer** - No merge conflicts or coordination needed
- 🚀 **MVP/Prototype phase** - Need rapid iteration and real device testing
- 📱 **Test devices only** - No real users, safe to break things
- ⚡ **Fast feedback** - Vercel auto-deploys master → test on Android immediately
- 🔧 **Simple setup** - Android client already points to production URL

**Current Workflow:**
```
Edit code → Commit to master → Push → Vercel auto-deploys (2-3 min)
                                      ↓
                              Test on Android device
```

**Acceptable Trade-offs:**
- ⚠️ Breaking changes go straight to production (acceptable risk)
- ⚠️ No staging environment (not needed yet)
- ⚠️ If something breaks, fix forward quickly

**Benefits:**
- ✅ Zero context switching between environments
- ✅ Immediate testing with real Android Management API
- ✅ No local dev environment complexity
- ✅ Focus 100% on feature development

---

## Transition Criteria: When to Add Development Branch (Phase 2)

**Trigger Events** (any one of these):

1. **Google Play Publishing Complete**
   - Android client published to Play Store
   - Devices auto-install app via FORCE_INSTALLED
   - Breaking changes require app updates

2. **Stable Production Data**
   - Multiple devices enrolled long-term
   - Re-enrollment would be costly (factory resets, new QR codes)
   - Production database has valuable data

3. **Multi-User/Multi-Device**
   - Other people using the system
   - Production downtime impacts others
   - Need to test changes before deploying

4. **Complex Features**
   - Large refactors that might break existing functionality
   - Database migrations that need testing
   - Integration with third-party services

**Recommended Trigger:** After Phase 4 (Google Play publishing) in implementation plan.

---

## Future Workflow: Development Branch + Vercel Previews (Phase 2)

### Branch Structure

```
master (production)          ← Stable, protected, deployed to bbtec-mdm.vercel.app
  ↑
  Pull Request + Review
  ↑
development                  ← Testing branch, Vercel preview deployment
  ↑
feature/new-feature          ← Feature branches
fix/bug-description          ← Bug fix branches
```

### Workflow

1. **Create feature branch from development**
   ```bash
   git checkout development
   git pull
   git checkout -b feature/apk-auto-update
   ```

2. **Develop and test locally (optional)**
   ```bash
   npm run dev
   npx convex dev
   ```

3. **Commit and push feature branch**
   ```bash
   git add .
   git commit -m "feat: Implement APK auto-update"
   git push -u origin feature/apk-auto-update
   ```

4. **Create Pull Request to development**
   - PR triggers Vercel preview deployment
   - Unique URL: `bbtec-mdm-git-feature-apk-auto-update.vercel.app`
   - Test changes on preview URL
   - Review code changes

5. **Merge to development**
   - Test on development preview deployment
   - Smoke test all features
   - Check device connections

6. **Promote to production**
   - Create PR: development → master
   - Final review
   - Merge to master
   - Auto-deploys to production

### Vercel Configuration

**Preview Deployments:**
- Every push to any branch gets a preview URL
- PR deployments are publicly accessible (or password-protected)
- Preview deployments use production Convex (or separate dev deployment)

**Environment Variables:**
- Production: Full credentials, production Convex
- Preview: Limited credentials, dev Convex (optional)

**Branch Deployment Settings:**
```
Production Branch: master
Preview Branches: all branches except master
```

---

## Local Development Environment Setup (Phase 3)

**When to set this up:**
- Need offline development capability
- Complex debugging requiring local control
- Database schema changes need local testing
- Experimenting with breaking changes

### Prerequisites

- Node.js 18+
- Android Studio (for Android client development)
- Android device/emulator with ADB access

### Setup Steps

#### 1. Next.js Local Server

```bash
# Terminal 1: Next.js dev server
npm run dev
# Runs on http://localhost:3000
```

#### 2. Convex Local Development

```bash
# Terminal 2: Convex dev
npx convex dev
# Creates local Convex deployment
# Separate database from production
```

**Environment Variables (.env.local):**
```bash
# Convex (local dev deployment)
NEXT_PUBLIC_CONVEX_URL=https://your-dev-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-dev-deployment

# Clerk (can reuse production or create dev app)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Google (can reuse production credentials for testing)
GOOGLE_SERVICE_ACCOUNT_BASE64=...
ENTERPRISE_NAME=enterprises/LC03fy18qv
GOOGLE_CLOUD_PROJECT_ID=bbtec-mdm
```

#### 3. Android Client Configuration

**Option A: Build Variant for Local Dev**

Create `android-client/app/src/debug/java/.../ApiClient.kt`:
```kotlin
private val baseUrl = "http://10.0.2.2:3000/api/client"  // Android emulator localhost
```

**Option B: ADB Reverse (Physical Device)**
```bash
adb reverse tcp:3000 tcp:3000
# Device can now access localhost:3000 via localhost:3000
```

**Build and install:**
```bash
cd android-client
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

#### 4. Testing Locally

1. Start Next.js dev server (`npm run dev`)
2. Start Convex dev (`npx convex dev`)
3. Open browser: `http://localhost:3000`
4. Test web UI locally
5. Install debug APK on device/emulator
6. Test Android client → local server

---

## Decision Log

### 2025-11-03: Adopt Fast Iteration on Production

**Context:**
- Working on MVP/prototype phase
- Single developer, no team coordination needed
- Need rapid feedback with real Android devices
- All changes are experimental/educational

**Decision:**
- Work directly on master branch
- Push to production immediately
- No development branch or local dev environment yet
- Acceptable risk for current project phase

**Review Date:** After Google Play publishing (Phase 4 complete)

---

## Git Commit Message Conventions

**Current practice:**
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Refactor code
test: Add tests
chore: Update dependencies
```

**Append to all commits:**
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Quick Reference

### Current Workflow (Phase 1)
```bash
# Make changes
git add .
git commit -m "feat: Add feature"
git push

# Wait 2-3 minutes for Vercel deployment
# Test on bbtec-mdm.vercel.app
```

### Future Workflow (Phase 2)
```bash
# Create feature branch from development
git checkout development
git checkout -b feature/xyz
# Make changes
git commit -m "feat: Add feature"
git push -u origin feature/xyz
# Create PR to development
# Test on Vercel preview URL
# Merge to development
# Test on development deployment
# Create PR to master
# Merge to production
```

### Local Development (Phase 3)
```bash
# Terminal 1
npm run dev

# Terminal 2
npx convex dev

# Terminal 3
cd android-client
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

**Last Updated:** 2025-11-03
**Next Review:** After Phase 4 (Google Play publishing) complete
