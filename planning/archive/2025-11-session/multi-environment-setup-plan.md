# Multi-Environment Development Workflow Setup Plan

**Created:** 2025-11-09
**Status:** Planning
**Transition:** Phase 1 (Production Only) → Phase 2/3 (Local → Dev → Production)

---

## Overview

Transition from current "develop on production" workflow to a robust 3-tier development workflow:

- **Local**: Development on your machine (Next.js + Convex backend running locally, no internet required)
- **Cloud Dev**: Staging environment (Vercel preview + Convex cloud dev deployment)
- **Cloud Production**: Current production (Vercel + Convex cloud production)

**Key Feature:** True local development with Convex backend running on your machine (beta feature, stored in `~/.convex/`). Work completely offline after initial setup!

---

## 1. Git Branch Strategy

### Create Branch Structure

```
master (production)          ← Protected, deployed to production
  ↑
  PR + Review
  ↑
development                  ← Deployed to Vercel preview
  ↑
feature/* branches           ← Local development
```

### Implementation

- Create `development` branch from current `master`
- Configure GitHub branch protection for `master` (require PR, prevent direct push)
- Future workflow: feature branch → development → master

---

## 2. Convex Multi-Environment Setup

### Current State

- Single Convex deployment: `https://kindly-mule-339.convex.cloud`
- All development happens against production database
- Schema changes deployed directly to production
- You already have a Convex dev deployment in cloud

### Target State

We'll use three separate Convex environments:

- **Local**: Convex backend running on your machine (true offline development, beta feature)
- **Development**: Your existing cloud dev deployment (permanent, for Vercel preview testing)
- **Production**: Keep existing `kindly-mule-339` (permanent, production deployment)

**Local Development Options:**
1. **`npx convex dev --local`** - Runs Convex backend on your machine (no internet needed after setup)
2. **First-time `npx convex dev`** - Prompts: "develop locally without account" or "create cloud account"
3. **Local state storage**: `~/.convex/` directory
4. **Local dashboard**: Included for debugging (localhost)

**Note:** Safari blocks localhost requests (use Chrome/Firefox). Brave blocks localhost by default (must enable).

### Configuration Files

- `.env.local` - Local development (points to local Convex backend: `http://127.0.0.1:3210`)
- `.env.development` - Cloud development (Vercel preview, points to your existing cloud dev deployment)
- `.env.production` - Cloud production (points to `kindly-mule-339`)

### Schema Deployment Strategy

- **Local changes**: Test with `npx convex dev --local` (runs backend on your machine, no internet required)
- **Dev deployment**: `npx convex deploy --prod <your-dev-deployment-name>` (push to cloud dev deployment)
- **Prod deployment**: `npx convex deploy --prod` (existing workflow, pushes to production)

### Convex Dashboard Setup

**Note:** You mentioned you already have a Convex dev deployment. If so, skip step 2 and use your existing deployment name.

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. (If needed) Create new deployment: `bbtec-mdm-dev` OR use your existing dev deployment
3. Copy deployment URL (e.g., `https://happy-bear-123.convex.cloud`)
4. Run `npx convex deploy --prod <your-dev-deployment-name>` to initialize/sync schema
5. (Optional) Copy data from production to dev for realistic testing

---

## 3. Vercel Multi-Environment Setup

### Deployment Configuration

- **Production Branch**: `master` → `bbtec-mdm.vercel.app`
- **Preview Branches**: `development` and `feature/*` → unique preview URLs
- Configure environment variables per environment in Vercel dashboard

### Environment Variables (Vercel Dashboard)

**Production Environment (master branch):**
- `NEXT_PUBLIC_CONVEX_URL` → `https://kindly-mule-339.convex.cloud`
- `CONVEX_DEPLOYMENT` → `prod:kindly-mule-339`
- `CLERK_SECRET_KEY` → (production key)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → (production key)

**Preview Environment (development + feature branches):**
- `NEXT_PUBLIC_CONVEX_URL` → `https://[your-dev-deployment].convex.cloud` (your existing dev deployment)
- `CONVEX_DEPLOYMENT` → `prod:[your-dev-deployment-name]`
- `CLERK_SECRET_KEY` → (can share or create separate Clerk dev app)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → (can share or separate)

### Vercel Configuration Steps

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select `bbtec-mdm` project
3. Go to Settings → Git
4. Set Production Branch: `master`
5. Go to Settings → Environment Variables
6. Add variables for Production (master branch only)
7. Add variables for Preview (all non-production branches)
8. Save and redeploy

---

## 4. Local Development Environment

### Setup Components

1. **Convex local backend** (`npx convex dev --local` - runs on your machine, port 3210, NO internet required)
2. **Next.js dev server** (`npm run dev` - runs on port 3000)
3. **Environment variables** (`.env.local` - auto-configured by Convex)
4. **Physical Android device** (recommended) OR Android emulator (resource-intensive)

**Note:** Convex local backend (beta) runs completely on your machine. Database stored in `~/.convex/`. Local dashboard included.

### New Files to Create

#### `.env.local` (Local Development)

```bash
# Convex (local backend running on your machine)
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
# OR if npx convex dev auto-configured it:
# NEXT_PUBLIC_CONVEX_URL=http://localhost:3210

# Clerk (can reuse production or create dev app)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Next.js
NODE_ENV=development
```

**Note:** When you run `npx convex dev --local`, it will automatically create/update `.env.local` with the correct local Convex URL.

#### `.env.development` (Cloud Dev - Vercel Preview)

```bash
# Convex (dev deployment)
NEXT_PUBLIC_CONVEX_URL=https://[your-dev-deployment].convex.cloud
CONVEX_DEPLOYMENT=prod:[your-dev-deployment-name]

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

#### `.env.production` (Cloud Production)

```bash
# Convex (production deployment)
NEXT_PUBLIC_CONVEX_URL=https://kindly-mule-339.convex.cloud
CONVEX_DEPLOYMENT=prod:kindly-mule-339

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Local Testing Flow

```bash
# Terminal 1: Start Convex local backend (TRUE local, no internet required!)
npx convex dev --local
# Runs Convex backend on your machine: http://127.0.0.1:3210
# Local database stored in ~/.convex/
# Local dashboard available in browser

# Terminal 2: Start Next.js dev server
npm run dev
# Runs on http://localhost:3000
# Connects to local Convex backend

# Terminal 3: Test Android client on PHYSICAL device (recommended)
# Connect phone via USB, enable USB debugging
cd android-client
./gradlew assembleDebug
adb reverse tcp:3000 tcp:3000  # Forward phone's port to laptop's localhost
adb install -r app/build/outputs/apk/debug/app-debug.apk
# Phone can now access localhost:3000!

# Alternative: Test on Android emulator (resource-intensive, may not work on T480s)
# ./gradlew installDebug  # Will install to running emulator
```

### Testing Workflow

1. Start local Convex backend (`npx convex dev --local`)
2. Edit code → See changes at `localhost:3000`
3. Test with local Convex backend (completely isolated from production)
4. Test web UI in browser
5. (Recommended) Test Android client on physical device via `adb reverse`

### Benefits of True Local Development

- ✅ **No internet required** (after initial setup)
- ✅ **Faster code sync** (no network latency)
- ✅ **No quota limits** (functions calls, database bandwidth)
- ✅ **Complete isolation** from production and dev cloud deployments
- ✅ **Work offline** (airplane, train, no WiFi)
- ✅ **Local debugging** with dashboard

---

## 5. Android Client Build Variants

### Current State

- Single build configuration
- Hardcoded production URL: `https://bbtec-mdm.vercel.app/api/client`
- One APK for all environments

### Target State

Create 3 build variants with different server URLs:

- **debug** → `http://localhost:3000/api/client` (for physical device testing with `adb reverse`)
- **staging** → Vercel preview URL (development branch deployment)
- **production** → `https://bbtec-mdm.vercel.app/api/client` (current)

**Note:** Physical device testing is recommended (lower resource usage on your Lenovo T480s). The debug flavor uses `localhost:3000` which works with physical devices via `adb reverse`. If you need emulator support, you can create a separate flavor with `http://10.0.2.2:3000/api/client`.

### Implementation

#### Update `android-client/app/build.gradle.kts`

```kotlin
android {
    namespace = "com.bbtec.mdm.client"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.bbtec.mdm.client"
        minSdk = 29
        targetSdk = 34
        versionCode = 38
        versionName = "0.0.38"
    }

    // ADD THIS: Product Flavors for different environments
    flavorDimensions += "environment"
    productFlavors {
        create("debug") {
            dimension = "environment"
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            // localhost works with physical device via adb reverse
            buildConfigField("String", "BASE_URL", "\"http://localhost:3000/api/client\"")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            buildConfigField("String", "BASE_URL", "\"https://bbtec-mdm-git-development.vercel.app/api/client\"")
        }
        create("production") {
            dimension = "environment"
            buildConfigField("String", "BASE_URL", "\"https://bbtec-mdm.vercel.app/api/client\"")
        }
    }

    buildFeatures {
        buildConfig = true  // Enable BuildConfig generation
    }

    // ... rest of existing config
}
```

#### Update `android-client/app/src/main/java/com/bbtec/mdm/client/ApiClient.kt`

```kotlin
class ApiClient(private val context: Context) {
    // REPLACE hardcoded URL with BuildConfig
    private val baseUrl = BuildConfig.BASE_URL

    // ... rest of existing code
}
```

### Build Commands

```bash
# Local testing on physical device (recommended)
./gradlew assembleDebug
adb reverse tcp:3000 tcp:3000  # Forward port first!
adb install -r app/build/outputs/apk/debug/debug/app-debug-debug.apk

# Staging testing (points to Vercel preview)
./gradlew assembleStaging
adb install -r app/build/outputs/apk/staging/debug/app-staging-debug.apk

# Production build (for direct APK distribution via your MDM system)
./gradlew assembleProductionRelease
# Output: app/build/outputs/apk/production/release/app-production-release.apk
```

### Testing with Physical Device (RECOMMENDED)

**Why physical device?**
- Lower resource usage on Lenovo T480s
- Real-world testing conditions
- No emulator performance overhead
- Faster iteration cycle

**Setup:**
```bash
# 1. Enable USB debugging on your Android device
#    Settings → About phone → Tap "Build number" 7 times
#    Settings → Developer options → Enable "USB debugging"

# 2. Connect device via USB cable
adb devices  # Verify device detected

# 3. Forward localhost port to device (critical step!)
adb reverse tcp:3000 tcp:3000
# Now device can access localhost:3000 as if it's its own localhost

# 4. Build and install debug APK
cd android-client
./gradlew installDebug
# Or manually: adb install -r app/build/outputs/apk/debug/debug/app-debug-debug.apk

# 5. Test app on device
# The app will connect to http://localhost:3000/api/client
# Which gets forwarded to your laptop's localhost:3000
```

### Testing with Android Emulator (Alternative)

**Only if physical device not available. Resource-intensive on T480s.**

```bash
# 1. Start emulator (Android Studio or command line)
emulator -avd Pixel_6_API_34

# 2. Forward localhost port to emulator
adb reverse tcp:3000 tcp:3000

# 3. Install debug APK
./gradlew installDebug

# Note: With emulator, you can use either:
# - http://localhost:3000 (with adb reverse)
# - http://10.0.2.2:3000 (emulator's special IP for host)
```

---

## 6. Migration Steps (Execution Order)

### Phase A: Git Setup (Low Risk - 10 minutes)

1. ✅ Create `development` branch from `master`
   ```bash
   git checkout master
   git pull
   git checkout -b development
   git push -u origin development
   ```

2. ✅ Configure GitHub branch protection for `master`
   - Go to GitHub repo → Settings → Branches
   - Add branch protection rule for `master`
   - Enable: "Require pull request before merging"
   - Enable: "Require status checks to pass before merging"
   - Save changes

3. ✅ Test: Try to push directly to master (should be blocked)

### Phase B: Convex Dev Deployment (Medium Impact - 30 minutes)

4. ✅ Create new Convex dev deployment
   - Open [Convex Dashboard](https://dashboard.convex.dev)
   - Click "New Deployment"
   - Name: `bbtec-mdm-dev`
   - Copy deployment URL

5. ✅ Initialize dev deployment with schema
   ```bash
   npx convex deploy --prod bbtec-mdm-dev
   ```

6. ⚠️ (Optional) Copy production data to dev
   - Convex doesn't have built-in data migration
   - Options:
     - Start with empty dev database
     - Manually create test data
     - Write script to copy data via queries

### Phase C: Environment Variables (Critical - 45 minutes)

7. ✅ Backup current environment files
   ```bash
   cp .env.local .env.local.backup
   ```

8. ✅ Create `.env.production`
   - Extract production values from current `.env.local`
   - Set `NEXT_PUBLIC_CONVEX_URL` to production Convex
   - Include all production credentials

9. ✅ Create `.env.development`
   - Point to dev Convex deployment
   - Optionally create separate Clerk dev app

10. ✅ Create new `.env.local` for local dev
    - Will be auto-populated by `npx convex dev`
    - Or manually point to dev Convex deployment

11. ✅ Update `.gitignore` (verify `.env*` excluded)
    ```bash
    # Should already exist, but verify:
    .env
    .env.local
    .env.*.local
    ```

12. ✅ Configure Vercel environment variables
    - Go to Vercel Dashboard → bbtec-mdm → Settings → Environment Variables
    - Add production variables (apply to Production only)
    - Add preview variables (apply to Preview only)
    - Delete any existing variables not scoped to specific environments

### Phase D: Android Client Build Variants (Optional - 1-2 hours)

13. ✅ Update `android-client/app/build.gradle.kts`
    - Add `flavorDimensions` and `productFlavors`
    - Enable `buildConfig` feature
    - Test build: `./gradlew tasks` (verify new tasks exist)

14. ✅ Update `ApiClient.kt` to use `BuildConfig.BASE_URL`
    - Replace hardcoded URL
    - Test compilation: `./gradlew compileDebugKotlin`

15. ✅ Test debug build
    ```bash
    ./gradlew assembleDebug
    adb reverse tcp:3000 tcp:3000
    adb install -r app/build/outputs/apk/debug/debug/app-debug-debug.apk
    ```

16. ⚠️ Update APK artifacts workflow
    - Production APKs should be built with `./gradlew assembleProductionRelease`
    - Update documentation in `artifacts/README.md`

### Phase E: Documentation & Testing (1 hour)

17. ✅ Update `planning/development-workflow.md`
    - Mark Phase 1 as "Archived"
    - Document new multi-environment workflow
    - Add troubleshooting section

18. ✅ Update `CLAUDE.md`
    - Add environment-specific instructions
    - Document which env vars belong to which environment
    - Add Convex deployment commands

19. ✅ Test full workflow (local → dev → production)
    ```bash
    # Local test
    git checkout -b feature/test-workflow
    npm run dev  # Terminal 1
    npx convex dev  # Terminal 2
    # Make a small change (e.g., add console.log)
    # Verify change appears at localhost:3000

    # Push to development
    git add .
    git commit -m "test: Verify multi-environment workflow"
    git push -u origin feature/test-workflow
    # Create PR to development on GitHub
    # Verify Vercel preview deployment created
    # Test on preview URL

    # Merge to development
    # Verify development preview deployment updated

    # Create PR from development to master
    # Merge to production
    # Verify production deployment
    ```

20. ✅ Create documentation commit
    ```bash
    git checkout development
    git add planning/multi-environment-setup-plan.md
    git add planning/development-workflow.md
    git add CLAUDE.md
    git commit -m "docs: Multi-environment development workflow setup"
    git push
    ```

---

## 7. New Development Workflow

### Daily Development (After Migration)

```bash
# 1. Create feature branch from development
git checkout development
git pull
git checkout -b feature/new-feature

# 2. Develop locally (completely offline!)
npx convex dev --local         # Terminal 1: Convex backend (localhost:3210)
npm run dev                    # Terminal 2: Next.js (localhost:3000)

# Make changes, test at localhost:3000
# Local Convex backend in ~/.convex/
# Test Android client (optional):
#   cd android-client
#   ./gradlew installDebug
#   adb reverse tcp:3000 tcp:3000

# 3. Commit and push to feature branch
git add .
git commit -m "feat: Add new feature"
git push -u origin feature/new-feature

# 4. Create PR to development
# - Go to GitHub
# - Create PR: feature/new-feature → development
# - Vercel auto-creates preview deployment
# - Preview URL: bbtec-mdm-git-feature-new-feature.vercel.app
# - Test on preview URL

# 5. Merge to development
# - Review code changes
# - Merge PR on GitHub
# - Vercel updates development preview deployment
# - Test on development deployment

# 6. Promote to production (when ready)
# - Create PR: development → master
# - Final review
# - Merge to master
# - Auto-deploys to production (bbtec-mdm.vercel.app)
# - Monitor production deployment
```

### Convex Schema Changes

```bash
# 1. Test locally (completely offline!)
npx convex dev --local
# Edit convex/schema.ts
# Convex local backend auto-syncs schema changes
# Test with Next.js dev server (localhost:3000)
# Local database in ~/.convex/

# 2. Deploy to cloud dev
npx convex deploy --prod <your-dev-deployment-name>
# Push code changes to feature branch
# Vercel preview will use cloud dev Convex deployment

# 3. Deploy to production
git checkout master
git pull
npx convex deploy --prod
# Schema changes now live in production
```

### Android Client Releases

```bash
# Development testing
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/debug/app-debug-debug.apk

# Staging testing (against Vercel preview)
./gradlew assembleStaging
adb install -r app/build/outputs/apk/staging/debug/app-staging-debug.apk

# Production release (for direct APK distribution)
./gradlew assembleProductionRelease
# APK is auto-signed using keystore configured in build.gradle.kts
# Distribute via your MDM system (upload to Convex APK storage)
```

---

## 8. Rollback Strategy

### If Something Goes Wrong

**Immediate Rollback:**
1. Revert to previous commit on `master`
2. Vercel auto-deploys previous version
3. No data loss (Convex keeps all data)

**Partial Rollback:**
- Keep current production setup untouched
- Test new workflow on `development` branch only
- Can continue current workflow on `master` while testing

**Complete Rollback:**
- Delete `development` branch
- Remove Vercel preview environment variables
- Continue using Phase 1 workflow (direct to production)

**Safety Nets:**
- ✅ Keep current `.env.local` backed up
- ✅ Keep `master` branch untouched until full testing complete
- ✅ Can run both workflows in parallel during transition
- ✅ Zero risk to production during setup

---

## 9. Key Decisions Needed

### Before Starting Migration

1. **Convex Deployments**
   - [ ] Create new named deployments (`bbtec-mdm-prod`, `bbtec-mdm-dev`)?
   - [ ] Or keep current one as prod, create only dev?
   - **Recommendation:** Keep `kindly-mule-339` as prod, create new `bbtec-mdm-dev`

2. **Clerk Authentication**
   - [ ] Separate dev/prod Clerk applications?
   - [ ] Or share credentials across environments?
   - **Recommendation:** Share initially, separate later if needed

3. **Android Client Build Variants**
   - [ ] Implement immediately?
   - [ ] Or defer until after backend environments working?
   - **Recommendation:** Defer to Phase 2 (focus on backend first)

4. **Data Migration**
   - [ ] Copy production data to dev Convex deployment?
   - [ ] Start with empty dev database?
   - **Recommendation:** Start empty, create test data as needed

5. **Branch Protection**
   - [ ] Require PR reviews for master?
   - [ ] Require status checks (CI/CD)?
   - **Recommendation:** Require PR, skip CI initially (add later)

### During Migration

6. **Environment Variables**
   - [ ] Which env vars should differ between dev/prod?
   - [ ] Which can be shared?
   - **Note:** Mainly just Convex URLs and Clerk keys. No third-party service credentials needed.

7. **Testing Strategy**
   - [ ] How much testing before promoting to production?
   - [ ] What defines "ready for production"?

---

## 10. Estimated Timeline

### Conservative Estimate

- **Phase A (Git Setup)**: 10 minutes
  - Create branch
  - Configure GitHub protection

- **Phase B (Convex Dev)**: 30 minutes
  - Create deployment via dashboard
  - Initialize schema

- **Phase C (Environment Variables)**: 45 minutes
  - Create `.env.*` files
  - Configure Vercel dashboard

- **Phase D (Android Variants)**: 1-2 hours *(Optional, can defer)*
  - Update Gradle config
  - Test builds

- **Phase E (Documentation/Testing)**: 1 hour
  - Update docs
  - End-to-end workflow test

**Total**: ~3-4 hours for full implementation
**Minimum**: ~1-2 hours if deferring Android build variants

### Aggressive Estimate (Minimal Viable Setup)

- Git branch: 5 min
- Convex dev deployment: 15 min
- Environment variables: 30 min
- Quick test: 10 min

**Total**: ~1 hour for basic setup

---

## 11. Success Criteria

### Phase Complete When:

✅ Can develop locally without affecting production
✅ Can test changes on Vercel preview deployments
✅ Can promote changes through development → master workflow
✅ Production remains stable and unchanged during migration
✅ Documentation updated and accurate
✅ Team (you) comfortable with new workflow

### Validation Tests:

1. **Local Development Test**
   - Start `npm run dev` and `npx convex dev`
   - Make a change, see it at `localhost:3000`
   - Verify separate database from production

2. **Development Deployment Test**
   - Push to `development` branch
   - Verify Vercel preview created
   - Test on preview URL
   - Verify uses dev Convex deployment

3. **Production Deployment Test**
   - Merge `development` → `master`
   - Verify production deployment
   - Verify no downtime
   - Verify production Convex unchanged

4. **Android Client Test** *(if implementing build variants)*
   - Build debug APK
   - Install on device/emulator
   - Test connection to localhost via `adb reverse`

---

## 12. Benefits After Migration

### Immediate Benefits

✅ **True offline development** - Convex backend runs on your machine, work without internet
✅ **Safe testing** - Changes don't affect production
✅ **Isolated environments** - Local/dev/prod databases completely separate
✅ **No quota limits** - Local development doesn't count against Convex plan limits
✅ **Faster iteration** - No network latency for database/function calls
✅ **Preview deployments** - Test on Vercel before merging
✅ **Git workflow** - Professional PR-based development

### Long-term Benefits

✅ **Parallel development** - Work on multiple features simultaneously
✅ **Database schema safety** - Test migrations before production
✅ **Android client testing** - Test against dev backend
✅ **Easier debugging** - Local environment for troubleshooting
✅ **Onboarding ready** - Can add collaborators without risk
✅ **Professional workflow** - Industry-standard practices

### Risk Reduction

✅ **No accidental production changes**
✅ **PR reviews catch issues early**
✅ **Rollback capability via Git**
✅ **Testing before deployment**

---

## 13. Troubleshooting Guide

### Common Issues

**Issue: Vercel preview not using correct Convex deployment**
- Solution: Check environment variables in Vercel dashboard
- Verify `NEXT_PUBLIC_CONVEX_URL` set for Preview environment

**Issue: Local Convex backend not starting**
- Solution: Run `npx convex dev --local --once` to reinitialize
- Check `.env.local` has correct `NEXT_PUBLIC_CONVEX_URL` (should be `http://127.0.0.1:3210`)
- Clear local state: `rm -rf ~/.convex/` and restart

**Issue: Local Convex dashboard not working**
- **Safari**: Blocks localhost requests by default - use Chrome or Firefox instead
- **Brave**: Blocks localhost by default - enable localhost in Brave settings
- **Chrome/Firefox**: Should work without issues

**Issue: Android client can't connect to localhost**
- Solution: Run `adb reverse tcp:3000 tcp:3000`
- Verify device is connected: `adb devices`
- Test connection: `adb shell curl http://localhost:3000`
- Physical device: Use `localhost:3000` with `adb reverse`
- Emulator: Can use `localhost:3000` (with adb reverse) OR `10.0.2.2:3000` (emulator special IP)

**Issue: Branch protection blocking pushes**
- Solution: This is expected! Create PR instead
- Or temporarily disable protection for testing

**Issue: Convex schema out of sync**
- Solution: Run `npx convex deploy --prod [deployment-name]`
- Verify schema.ts matches deployment

### Emergency Procedures

**If production breaks:**
1. Revert last commit on `master`
2. Push to trigger Vercel redeploy
3. Verify production restored
4. Debug on `development` branch

**If development environment broken:**
- Safe to experiment - production unaffected
- Can delete and recreate dev Convex deployment
- Can reset `development` branch to `master`

---

## 14. Next Steps After Migration

### Phase 2 Enhancements

1. **CI/CD Pipeline**
   - Add GitHub Actions
   - Auto-run tests on PR
   - Auto-deploy APKs to artifacts/

2. **Monitoring & Logging**
   - Add error tracking (Sentry)
   - Add analytics (Vercel Analytics)
   - Add Convex monitoring

3. **Advanced Android Testing**
   - Staging flavor with production-like data
   - Beta testing with select devices (via direct APK distribution)
   - Automated UI tests

4. **Database Management**
   - Convex migrations scripts
   - Data seeding for dev environment
   - Backup/restore procedures

### Phase 3 - Scaling Considerations

- Multiple developers workflow
- Code review requirements
- Release management process
- Automated APK builds and distribution (GitHub Actions → Convex storage)

---

## 15. References

### Documentation Links

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Convex Multi-Deployment](https://docs.convex.dev/production/hosting/deploy-options)
- [Android Build Variants](https://developer.android.com/build/build-variants)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)

### Internal Documentation

- `planning/development-workflow.md` - Current workflow documentation
- `CLAUDE.md` - Project context and conventions
- `android-client/README.md` - Android client documentation

---

**Last Updated:** 2025-11-09
**Next Review:** After successful migration and 2 weeks of usage
**Owner:** Ben (solo developer)
