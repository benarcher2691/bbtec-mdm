# Deployment Procedures

Complete guide for promoting code through environments: Local → Staging → Production.

**Current Promotion Status:** See [planning/PLAN.md](../planning/PLAN.md) for blockers, checklist, and current work.

---

## Overview

### Multi-Environment Architecture

| Environment | Branch | Vercel | Convex | Database | Purpose |
|-------------|--------|--------|--------|----------|---------|
| **Local** | feature/* | localhost:3000 | 127.0.0.1:3210 | `~/.convex/` | Offline development |
| **Staging** | development | Preview deploy | kindly-mule-339 | Cloud (isolated) | Testing before production |
| **Production** | master | bbtec-mdm.vercel.app | expert-lemur-691 | Cloud (live) | Live system |

### Promotion Path

```
feature/* → development → master
  (PR)         (PR)
  ↓            ↓
Staging      Production
```

**Branch Protection:** Both `development` and `master` are protected. All changes require Pull Requests.

---

## Phase 1: Deploy to Staging (Development Branch)

### Step 1: Create Pull Request

```bash
# Ensure you're on feature branch with all changes committed
git status

# Push to GitHub
git push origin feature/your-feature-name

# Create PR on GitHub:
# Source: feature/your-feature-name
# Target: development
# Title: Brief description of changes
# Description: What changed, why, testing done
```

**Branch Protection:** Direct push to `development` is blocked. PR required.

---

### Step 2: Vercel Preview Deployment

**Automatic Behavior:**
- Vercel detects PR to `development`
- Auto-creates preview deployment
- URL format: `bbtec-mdm-git-{branch-name}-{hash}.vercel.app`
- Uses "Preview" scope environment variables

**Preview URL Detection:**
- Preview gets dynamic URL (changes per deployment)
- Code should use `VERCEL_URL` environment variable (auto-provided by Vercel)
- **Critical:** Do NOT set `NEXT_PUBLIC_APP_URL` in preview scope
- Let code detect from `VERCEL_URL`: `https://${process.env.VERCEL_URL}`

---

### Step 3: Configure Preview Environment Variables

**Vercel Dashboard** → Project Settings → Environment Variables → **Preview** scope:

```bash
# Convex Cloud Dev
NEXT_PUBLIC_CONVEX_URL=https://kindly-mule-339.convex.cloud
CONVEX_DEPLOYMENT=prod:kindly-mule-339

# Clerk (same keys as local - test environment)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER_URL=https://living-skunk-13.clerk.accounts.dev

# DO NOT SET NEXT_PUBLIC_APP_URL - let VERCEL_URL handle it!
```

**Why no `NEXT_PUBLIC_APP_URL`?**
- Preview URL changes with each deployment
- Vercel provides `VERCEL_URL` automatically
- Code should fall back to `VERCEL_URL` for dynamic detection

---

### Step 4: Deploy Convex Schema to Cloud Dev

```bash
# Deploy schema and functions to cloud dev
npx convex deploy --prod kindly-mule-339
```

**What this does:**
- Uploads schema changes to cloud dev Convex
- Deploys all mutations/queries
- Does NOT deploy frontend (Vercel handles that)

**When to run:**
- After modifying `convex/schema.ts`
- After changing any Convex functions
- Before testing in preview

---

### Step 5: Setup Cloud Dev Database

**Initial Setup (First Time):**

1. **Create Default Policy**
   - Navigate to preview URL
   - Go to Policies page
   - Create default policy with desired settings

2. **Create Company User**
   - Navigate to Company → Users
   - Create test company user
   - Required for generating enrollment tokens

3. **Build Staging APK**
   ```bash
   cd android-client
   ./gradlew clean assembleStagingRelease
   ```
   - APK location: `app/build/outputs/apk/staging/release/app-staging-release.apk`
   - Package: `com.bbtec.mdm.client.staging`
   - Signs with production keystore

4. **Extract Staging APK Signature**
   ```bash
   /opt/android-sdk/build-tools/34.0.0/apksigner verify --print-certs \
     app/build/outputs/apk/staging/release/app-staging-release.apk \
     | grep SHA-256 | head -1 | awk '{print $2}'
   ```
   - Convert to URL-safe Base64 (no `=` padding, `+/` → `-_`)
   - Update code if using environment-aware signature approach

5. **Upload Staging APK**
   - Navigate to Applications page in preview
   - Upload `app-staging-release.apk`
   - Verify upload succeeds and metadata displays correctly

**Database Seeding (Future):**
- Consider creating seed script for policies and users
- Helps with faster preview environment setup

---

### Step 6: Test in Preview

**Testing Checklist:**

- [ ] **QR Code Generation**
  - Generate enrollment QR code
  - **Verify URL is preview URL** (not production!)
  - Verify APK download URL
  - Check signature checksum matches staging APK

- [ ] **Device Enrollment**
  - Factory reset Android device
  - Scan QR code during setup
  - Verify APK downloads (check Vercel logs)
  - Verify provisioning completes
  - Check device appears in dashboard

- [ ] **APK Download**
  - Verify redirect to Convex cloud storage (not localhost)
  - Check download succeeds
  - Verify APK installs correctly

- [ ] **Dashboard Functionality**
  - Device list shows enrolled device
  - Device details display correctly
  - Commands work (lock, reboot - be careful with wipe!)
  - Heartbeat updates

- [ ] **Authentication**
  - Sign in works
  - Sign out doesn't crash (Convex auth race condition)
  - Session persists across page reload

- [ ] **Environment Detection**
  - Check logs: Environment should be "cloud" not "local"
  - Verify no localhost URLs in QR codes or logs
  - Confirm using cloud dev Convex (kindly-mule-339)

**Common Issues:**

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| QR code has production URL | `NEXT_PUBLIC_APP_URL` set in preview | Remove from preview env vars |
| Signature mismatch | Wrong signature in code | Update signature to match staging APK |
| APK download 404 | APK not uploaded to cloud dev Convex | Upload APK via Applications page |
| Empty database | Cloud dev not seeded | Create policy and company user |

---

### Step 7: Merge to Development

**After successful preview testing:**

1. **Get approval** (if working with team)
2. **Squash and merge** PR on GitHub
3. **Delete feature branch** (cleanup)

**Result:**
- Code now in `development` branch
- Vercel preview URL becomes staging URL (or new deployment)
- Cloud dev Convex (`kindly-mule-339`) continues to be used

---

## Phase 2: Deploy to Production (Master Branch)

### Step 1: Validation Period

**Before promoting to production:**
- Use staging for 1-3 days minimum
- Test all critical flows multiple times
- Monitor for errors or edge cases
- Verify heartbeat resilience (if testing that feature)
- Get user feedback (if applicable)

---

### Step 2: Build Production APK

```bash
cd android-client

# Clean build for production
./gradlew clean assembleProductionRelease
```

**APK Location:** `app/build/outputs/apk/production/release/app-production-release.apk`

**Package Name:** `com.bbtec.mdm.client` (no suffix)

**Signing:** Production keystore (`bbtec-mdm.keystore`)

---

### Step 3: Extract Production APK Signature

```bash
/opt/android-sdk/build-tools/34.0.0/apksigner verify --print-certs \
  app/build/outputs/apk/production/release/app-production-release.apk \
  | grep SHA-256 | head -1 | awk '{print $2}'
```

**Convert to URL-safe Base64:**
- Remove `=` padding
- Replace `+` with `-`
- Replace `/` with `_`

**Update code if needed** (if using environment-aware hardcoded signatures)

---

### Step 4: Create PR to Master

```bash
# Ensure development branch is up to date
git checkout development
git pull origin development

# Push if needed
git push origin development

# Create PR on GitHub:
# Source: development
# Target: master
# Title: "Release: [brief description]"
# Description: Summary of changes since last production release
```

**Branch Protection:** Direct push to `master` is blocked. PR required.

---

### Step 5: Configure Production Environment Variables

**Vercel Dashboard** → Project Settings → Environment Variables → **Production** scope:

```bash
# Convex Production
NEXT_PUBLIC_CONVEX_URL=https://expert-lemur-691.convex.cloud
CONVEX_DEPLOYMENT=prod:expert-lemur-691

# Clerk (same test keys - update when ready for production Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER_URL=https://living-skunk-13.clerk.accounts.dev

# Production URL (optional - can be auto-detected from Vercel)
NEXT_PUBLIC_APP_URL=https://bbtec-mdm.vercel.app
```

**Note:** `NEXT_PUBLIC_APP_URL` can be set in production since URL is stable (doesn't change).

---

### Step 6: Deploy Convex Schema to Production

```bash
# Deploy schema and functions to production Convex
npx convex deploy --prod expert-lemur-691
```

**Critical:** Always deploy Convex schema BEFORE merging PR to master.

**Why:** Vercel production deploy happens automatically when PR merges. Frontend code may expect new schema fields.

---

### Step 7: Setup Production Database

**Initial Production Setup:**

1. **Create Default Policy**
   - Navigate to production URL
   - Create production-ready default policy

2. **Create Company Users**
   - Create real company users (not test users)

3. **Upload Production APK**
   - Navigate to Applications page
   - Upload `app-production-release.apk`
   - Verify metadata correct

**Data Migration (if needed):**
- If migrating from staging, export/import data manually
- Convex doesn't have automatic migration tools
- Consider creating migration scripts for future deploys

---

### Step 8: Merge PR and Deploy

**GitHub:**
1. Review PR one final time
2. **Merge** (not squash - keep commit history for releases)
3. Delete `development` branch? **NO** - keep it for future work

**Vercel Automatic Deployment:**
- Detects merge to `master`
- Triggers production deployment
- URL: `https://bbtec-mdm.vercel.app`
- Uses "Production" scope environment variables

**Monitor deployment:**
- Check Vercel dashboard for build status
- Watch for build errors
- Verify deployment succeeds

---

### Step 9: Smoke Test Production

**Critical Tests (DO NOT SKIP):**

- [ ] **Access Production URL**
  - `https://bbtec-mdm.vercel.app` loads
  - No errors in browser console
  - Authentication works

- [ ] **Generate QR Code**
  - Create enrollment token
  - Generate QR code
  - **Verify URL is production** (not staging or localhost!)
  - Verify signature matches production APK

- [ ] **Test Device Enrollment (Non-Critical Device)**
  - Factory reset test device (NOT production device!)
  - Scan QR code
  - Verify APK downloads
  - Verify provisioning completes
  - Check device appears in production dashboard

- [ ] **Basic Dashboard Operations**
  - View device list
  - View device details
  - Test ONE non-destructive command (e.g., lock, then unlock from device)
  - Check heartbeat updates

- [ ] **Monitor for Errors**
  - Check Vercel logs for errors
  - Check browser console for errors
  - Monitor for 5-10 minutes

**If any test fails:** Investigate immediately. Consider rollback if critical.

---

## Rollback Procedures

### Rollback Production

**If production deploy has critical issues:**

**Option 1: Revert via Vercel Dashboard (Fastest)**
1. Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "Promote to Production"
4. Confirm rollback

**Option 2: Revert via Git (More Thorough)**
```bash
# Create revert commit
git revert <commit-hash>

# Push revert
git push origin master

# Vercel auto-deploys the revert
```

**Option 3: Emergency Fix Forward**
- Create hotfix branch from master
- Fix critical issue
- PR directly to master (explain emergency in PR)
- Deploy quickly

**Don't forget:** May need to revert Convex schema too
```bash
# Convex doesn't have built-in rollback
# May need to manually revert schema changes
npx convex deploy --prod expert-lemur-691
```

---

### Rollback Staging

**If staging has issues:**

**Option 1: Fix in Feature Branch**
- Create new commits in feature branch
- Push to GitHub
- PR auto-updates
- Vercel re-deploys preview

**Option 2: Close PR**
- Close the PR on GitHub
- Vercel stops deploying preview
- Start over with new feature branch

---

## Testing Matrix

| Environment | APK Variant | Package Name | Keystore | Signature | URL |
|-------------|-------------|--------------|----------|-----------|-----|
| **Local** | `localDebug` | `com.bbtec.mdm.client` | Debug | Debug cert | `http://192.168.x.x:3000` |
| **Staging** | `stagingRelease` | `com.bbtec.mdm.client.staging` | Production | Production cert | `https://*.vercel.app` (preview) |
| **Production** | `productionRelease` | `com.bbtec.mdm.client` | Production | Production cert | `https://bbtec-mdm.vercel.app` |

**Key Differences:**
- **Local**: Debug signing, dynamic LAN IP, offline mode
- **Staging**: Production signing, preview URL, cloud Convex dev
- **Production**: Production signing, stable URL, cloud Convex production

**APK Compatibility:**
- Local + Staging: Can install simultaneously (different package names)
- Local + Production: **CANNOT** install simultaneously (same package name)
- Staging + Production: Can install simultaneously (different package names)

---

## Common Issues & Solutions

### Issue: QR Code Has Wrong URL

**Symptoms:**
- Staging QR code shows production URL
- Local QR code shows wrong IP

**Causes:**
1. `NEXT_PUBLIC_APP_URL` hardcoded in wrong environment
2. `VERCEL_URL` not being used in preview
3. Dynamic IP detection not working locally

**Solutions:**
- **Staging:** Remove `NEXT_PUBLIC_APP_URL` from preview scope, use `VERCEL_URL`
- **Production:** Verify `NEXT_PUBLIC_APP_URL` is set correctly
- **Local:** Restart Next.js server to re-detect IP

---

### Issue: APK Signature Mismatch

**Symptoms:**
- Device provisioning fails with "signature checksum" error
- QR code signature doesn't match APK

**Causes:**
1. Wrong signature hardcoded in `apk-signature-client.ts`
2. Built APK with wrong keystore
3. Signature extraction used wrong certificate

**Solutions:**
- Extract signature from actual APK being uploaded
- Convert to URL-safe Base64 (no padding, `+/` → `-_`)
- Update code to match actual signature
- Rebuild APK if using wrong keystore

---

### Issue: Empty Database in Staging/Production

**Symptoms:**
- Can't generate QR code (no policies)
- No company users to assign devices to

**Causes:**
- New Convex deployment starts with empty database
- Schema deployed but no data seeded

**Solutions:**
- Manually create default policy via web UI
- Manually create company user via web UI
- Consider creating seed script for future deployments

---

### Issue: Convex Schema Mismatch

**Symptoms:**
- Errors like "field not found"
- Crashes when querying database
- Missing fields in dashboard

**Causes:**
- Convex schema not deployed after code changes
- Frontend expects fields that don't exist in database

**Solutions:**
```bash
# Deploy schema to correct environment
npx convex deploy --prod kindly-mule-339   # Staging
npx convex deploy --prod expert-lemur-691  # Production
```

**Prevention:** Always deploy Convex schema BEFORE deploying frontend

---

### Issue: Authentication Errors on Sign-Out

**Symptoms:**
- "Not authenticated" errors when signing out
- Convex queries fail during sign-out

**Causes:**
- Race condition between Clerk and Convex auth state
- Components not using `<Authenticated>` wrapper

**Solutions:**
- See `docs/authentication-patterns.md` for fix
- Use `useAppAuth()` hook
- Wrap components in `<Authenticated>`

---

## Deployment Checklist Template

**Copy this for each deployment:**

### Pre-Deployment
- [ ] All tests passing locally
- [ ] Branch up to date with target branch
- [ ] Convex schema changes documented
- [ ] APK built for target environment
- [ ] APK signature extracted and verified

### Staging Deployment
- [ ] PR created to development
- [ ] Vercel preview created
- [ ] Preview environment variables configured
- [ ] Convex schema deployed to cloud dev
- [ ] Cloud dev database seeded
- [ ] APK uploaded to cloud dev
- [ ] QR code generated and verified
- [ ] Test device enrolled successfully
- [ ] Dashboard functionality tested
- [ ] No errors in logs

### Production Deployment
- [ ] Staging validation period complete (1-3 days)
- [ ] Production APK built
- [ ] Production signature extracted
- [ ] PR created to master
- [ ] Production environment variables configured
- [ ] Convex schema deployed to production
- [ ] Production database seeded
- [ ] PR merged to master
- [ ] Vercel production deploy succeeded
- [ ] Smoke tests passed
- [ ] Monitoring for errors

---

**Last Updated:** 2025-11-11
**Version:** 1.0
**Status:** Initial deployment procedures documentation
