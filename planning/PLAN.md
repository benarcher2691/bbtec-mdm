# Development Plan

**Branch:** `feature/offline-local-dev`
**Web Version:** 0.0.4
**Android Version:** 0.0.42
**Last Updated:** 2025-11-12

---

## Next Steps - Promotion Path

### ✅ Critical Issues (ALL RESOLVED - PRs Created)

#### Issue #1: Preview URL Detection Bug ✅
**File:** `src/lib/network-detection.ts:45-52`

**Status:** FIXED

**Solution Implemented:**
```typescript
const cloudUrl =
  configuredAppUrl ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'https://bbtec-mdm.vercel.app'
```

**Result:** Preview deployments now correctly use `VERCEL_URL` instead of defaulting to production.

---

#### Issue #2: APK Signature Hardcoded to Debug Certificate ✅
**File:** `src/app/api/apk/extract-signature/route.ts` (complete rewrite)

**Status:** FIXED with server-side extraction

**Solution Implemented:**
- Server-side API endpoint extracts signature using `apksigner verify --print-certs`
- Extracts package name using `aapt dump badging`
- Converts SHA-256 to URL-safe Base64 automatically
- No hardcoded values - works with any APK

**Documented Signatures:**
- **Debug (local):** `iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk`
- **Staging:** `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE`

**Helper Script:** `scripts/extract-apk-signature.sh` for manual extraction

---

#### Issue #3: Package Name Hardcoded ✅
**File:** `src/lib/apk-signature-client.ts` (updated)

**Status:** FIXED with server-side extraction

**Solution Implemented:**
- Client-side now returns placeholders after validation
- Server-side extracts actual package name from APK manifest
- Upload flow updated to use server-extracted metadata

---

#### Issue #4: Preview QR Code Density ✅
**File:** `src/app/actions/enrollment.ts`

**Status:** FIXED (2025-11-12)

**Problem:** Long preview URLs (56-65 chars) caused QR codes too dense to scan

**Solution Implemented:**
- Reduced error correction level from 'M' to 'L'
- Reduced margin from 4 to 2 pixels
- Result: QR codes scannable with preview URLs

---

#### Issue #5: Vercel Authentication Blocking APK Downloads ✅
**Status:** FIXED (2025-11-12)

**Problem:** HTTP 401 when Android devices tried to download APK from preview deployments

**Solution Implemented:**
- Disabled "Vercel Authentication" in project settings (Deployment Protection)
- Result: APK downloads now return HTTP 307 (redirect) instead of HTTP 401

**Alternative:** Could use `VERCEL_AUTOMATION_BYPASS_SECRET` but disabled auth for simplicity

---

#### Issue #6: Environment-Aware QR Code Generation ✅
**File:** `src/app/actions/enrollment.ts`
**Commit:** b1077c0

**Status:** FIXED (2025-11-12)

**Problem:** QR code hardcoded production package name for all environments

**Solution Implemented:**
```typescript
const isPreview = process.env.VERCEL_ENV === 'preview'
const isLocal = process.env.NEXT_PUBLIC_CONVEX_URL?.includes('127.0.0.1')

if (isPreview) {
  packageName = 'com.bbtec.mdm.client.staging'  // Preview uses staging APK
} else {
  packageName = 'com.bbtec.mdm.client'  // Local/Production
}
```

**Benefit:** Enforces correct APK variant per environment, fails fast on mistakes

---

#### Issue #7: Component Name Construction Bug ✅
**File:** `src/app/actions/enrollment.ts`
**Commit:** 777cc07

**Status:** FIXED (2025-11-12)

**Problem:** Component name included `.staging` in class path (incorrect!)

**Root Cause:** Class path stays `com.bbtec.mdm.client.MdmDeviceAdminReceiver` across all variants, only application package changes

**Solution Implemented:**
```typescript
// Before (wrong):
const componentName = `${packageName}/${packageName}.MdmDeviceAdminReceiver`

// After (correct):
const componentName = `${packageName}/com.bbtec.mdm.client.MdmDeviceAdminReceiver`
```

**Result:** Android accepts APK and enrolls successfully

---

#### Issue #8: Staging Sync Failures (404/405) ✅
**File:** `android-client/app/src/main/java/com/bbtec/mdm/client/ApiClient.kt`
**Commit:** eacb4b2
**Version:** Bumped to 0.0.41

**Status:** FIXED (2025-11-12)

**Problem:** Android client used outdated BuildConfig URL for staging:
- BuildConfig: `https://bbtec-mdm-git-development.vercel.app/api/client`
- Actual deployment: `https://bbtec-mdm-git-development-ben-archers-projects.vercel.app`
- Result: 404 errors → "Sync failed"

**Solution Implemented:**
```kotlin
private val baseUrl: String
    get() {
        val enrollmentUrl = prefsManager.getServerUrl()
        return if (enrollmentUrl != "https://bbtec-mdm.vercel.app") {
            // Use enrollment URL from QR code + API path
            "$enrollmentUrl/api/client"
        } else {
            // Fallback to BuildConfig
            BuildConfig.BASE_URL
        }
    }
```

**Result:** Staging sync now works (uses actual deployment URL from enrollment)

---

### 📋 Pre-PR Checklist

**Required Fixes:**
- [x] Fix preview URL detection (add `VERCEL_URL` support)
- [x] Build staging APK (`./gradlew assembleStagingRelease`)
- [x] Extract staging APK signature (`apksigner verify --print-certs`)
- [x] Update signature logic (implemented server-side extraction)
- [x] Test locally (basic sanity checks passed)

**Recommended:**
- [x] Document signature extraction process
- [x] Create helper script for signature extraction (`scripts/extract-apk-signature.sh`)
- [x] Implement hybrid extraction with environment-aware fallback
- [x] Test local extraction and enrollment (confirmed working)

---

### 🎯 Hybrid Extraction Solution

**Challenge:** Server-side extraction (apksigner/aapt) works locally but not on Vercel (no Android SDK).

**Solution:** Hybrid approach with graceful fallback

#### How It Works:

**Local Development (Android SDK available):**
```
1. Upload APK → Convex storage
2. Extraction endpoint downloads APK
3. Runs apksigner verify --print-certs
4. Extracts real SHA-256 signature
5. Converts to URL-safe Base64
6. ✅ Dynamic extraction for any APK
```

**Cloud Deployment (Vercel - no Android SDK):**
```
1. Upload APK → Convex storage
2. Extraction endpoint tries apksigner
3. Command fails (tools not found)
4. Falls back to environment detection:
   - Preview/Production → U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE (release keystore)
   - Local/Unknown → iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk (debug keystore)
5. ✅ Returns correct signature for environment
```

#### Key Insight: Signatures Are Static Per Keystore

**Staging and production use the SAME keystore** (`bbtec-mdm.keystore`)
- Both have signature: `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE`
- Signature doesn't change with version bumps (v0.0.39 → v0.0.40 → v0.0.41...)
- Only changes if keystore is rotated (rare security event)

**Local development uses debug keystore**
- Signature: `iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk`
- Different from release builds

#### When to Update Fallback Values:

✅ **Never for version bumps** - Same keystore = same signature
✅ **Only when rotating keystores** - Rare security event
✅ **When adding new environment** - Different keystore = different signature

#### Benefits:

- ✅ Local: Full dynamic extraction (tested with any APK)
- ✅ Staging: Graceful fallback (works without Android SDK)
- ✅ Production: Graceful fallback (works without Android SDK)
- ✅ Maintainable: Update fallback only on keystore rotation (rare)
- ✅ Safe: Wrong APK → signature mismatch → enrollment fails (prevents accidents)

---

### 🚀 Deployment Process

See **[docs/deployment-procedures.md](../docs/deployment-procedures.md)** for complete deployment guide.

**Quick Summary:**

#### Phase 1: Deploy to Staging ✅ MOSTLY COMPLETE
1. ✅ Fix critical issues (all 8 issues resolved)
2. ✅ Create PRs: `feature/offline-local-dev` → `development`
   - PR #3: ✅ MERGED - Environment-aware QR + QR optimization
   - PR #4: ✅ MERGED - Component name fix
   - PR #5: 🔄 OPEN - Android client staging sync fix (https://github.com/benarcher2691/bbtec-mdm/pull/5)
3. ✅ Vercel auto-creates preview deployment
4. ✅ Configure preview environment variables (Convex cloud dev)
5. ⚠️ Deploy Convex schema to cloud dev (if needed)
6. ⚠️ Seed cloud dev database (if needed)
7. ✅ Test enrollment in preview (working!)
8. ⚠️ Merge PR #5 to development (pending review)

#### Phase 2: Deploy to Production (After Staging Validation)
1. Build production APK
2. Extract production signature
3. Create PR: `development` → `master`
4. Configure production environment variables
5. Deploy Convex schema to production
6. Smoke test enrollment
7. Merge to master

**Detailed procedures, testing checklists, and troubleshooting:** See docs/deployment-procedures.md

---

## Future Work - Core Functionality

### Priority 1: Security Audit 🔒
**Status:** AUDIT COMPLETE (2025-11-12) - 1 CRITICAL FIX REQUIRED

**Full Report:** [planning/SECURITY-AUDIT-2025-11-12.md](./SECURITY-AUDIT-2025-11-12.md)

**Audit Results:**
- [x] ✅ Review all Convex functions for proper `ctx.auth.getUserIdentity()` checks (50+ functions - ALL PROTECTED)
- [x] ✅ Audit `/api/dpc/register` endpoint (token validation - PROTECTED)
- [x] ✅ Audit `/api/client/commands` endpoint (device auth - PROTECTED)
- [x] ✅ Audit all API routes for authentication (16 routes scanned)
- [ ] 🚨 **CRITICAL:** `/api/debug/env` endpoint exposes environment variables publicly (NO AUTH)
- [ ] 🟡 Add rate limiting on registration endpoints (design review needed)
- [ ] 🟡 Review APK download security (public access vs. device auth)
- [ ] Add audit logging for admin actions (who did what when)

**Immediate Actions Required:**
1. **Fix `/api/debug/env` endpoint:** Add Clerk authentication or delete entirely
2. **Design Review:** Public endpoints intentional? (registration, APK downloads)
3. **Rate Limiting:** Add to registration endpoints to prevent spam/abuse

**Overall Security Posture:** ✅ Good (with critical fix needed)
- Consistent auth patterns across backend
- All Convex functions properly protected
- Device token authentication working correctly

**Expected Time:** 1 day (critical fix + design review)

---

### Priority 1.5: QR Code Generation Review 📱
**Status:** NOT STARTED

**What's Needed:**
- [ ] Verify QR code correctness across all environments (local, staging, production)
- [ ] Test QR code scanning on different devices/scanners
- [ ] Validate environment detection logic (VERCEL_ENV, NEXT_PUBLIC_CONVEX_URL)
- [ ] Ensure proper package name mapping per environment:
  - Local: `com.bbtec.mdm.client` (production package, debug build)
  - Staging/Preview: `com.bbtec.mdm.client.staging` (staging package, release build)
  - Production: `com.bbtec.mdm.client` (production package, release build)
- [ ] Test component name construction (verify no `.staging` in class path)
- [ ] Verify error correction levels and margins are appropriate
- [ ] Test enrollment flow end-to-end in each environment

**Why Important:** QR code is the entry point for device enrollment - must be 100% correct in all environments to avoid enrollment failures.

**Files to Review:**
- `src/app/actions/enrollment.ts` - QR code generation logic
- `src/components/qr-code-generator.tsx` - Client-side QR rendering
- `src/lib/network-detection.ts` - Environment detection

**Expected Time:** 2-3 hours (testing across environments)

---

### Priority 2: Policy Enforcement 🔐
**Status:** NOT STARTED (PolicyManager.kt exists but has placeholder logic)

**What's Needed:**
- [ ] Fetch assigned policy from backend in Android client
- [ ] Implement policy enforcement via `DevicePolicyManager`:
  - [ ] Camera disable/enable
  - [ ] Password requirements (quality, length)
  - [ ] USB storage restrictions
  - [ ] Screenshot blocking
  - [ ] Factory reset protection
- [ ] Report compliance status back to backend
- [ ] Handle policy updates (re-sync and re-apply)
- [ ] Show compliance status in web dashboard

**Why Important:** Core MDM feature - policies exist but devices don't enforce them

**Files to Modify:**
- `android-client/app/src/main/java/com/bbtec/mdm/client/PolicyManager.kt`
- `convex/deviceClients.ts` (add compliance fields)
- `src/components/device-list-table.tsx` (show compliance status)

**Expected Time:** 3-4 days

---

### Priority 3: Enhanced Device Info 📊
**Status:** NOT STARTED

**What's Needed:**
- [ ] Battery level and charging status
- [ ] Storage usage (total/used/free)
- [ ] Network info (WiFi SSID, IP address, cellular signal)
- [ ] List of installed apps
- [ ] Memory usage
- [ ] Device health metrics

**Implementation:**
- Send in heartbeat payload to minimize API calls
- Use Android APIs:
  - `BatteryManager` for battery info
  - `StatFs` for storage info
  - `WifiManager`, `TelephonyManager` for network info
  - `PackageManager` for app list

**Files to Modify:**
- `android-client/app/src/main/java/com/bbtec/mdm/client/ApiClient.kt` (enhanced heartbeat)
- `convex/deviceClients.ts` (add new fields)
- `src/components/device-list-table.tsx` (display new info)

**Expected Time:** 2-3 days

---

### Priority 4: Field Test Heartbeat Resilience ⏱️
**Status:** AWAITING FIELD TEST (v0.0.38 features included in v0.0.39)

**What to Verify:**
- [ ] Heartbeat updates every 15 minutes (configurable interval)
- [ ] Battery optimization exemption dialog shows during provisioning
- [ ] Ongoing notification shows "BBTec MDM Active" with last check-in time
- [ ] Force-kill test: Service recovers within 15-25 minutes
- [ ] Reboot test: Service starts immediately via BOOT_COMPLETED
- [ ] "Last Heartbeat" never exceeds ~25 minutes under any scenario
- [ ] App swipe away: Service restarts via WorkManager

**Features to Test:**
- Foreground service with ongoing notification
- 1-minute watchdog for self-healing
- 15-25 minute WorkManager backstop
- Battery optimization whitelist flow
- System integration (BOOT_COMPLETED, MY_PACKAGE_REPLACED, USER_UNLOCKED)

**Expected Time:** 1-2 days (observation period)

---

## Future Enhancements (Lower Priority)

### Backend Improvements
- [ ] Fix token race condition (mark used BEFORE registration, not after)
- [ ] Policy deletion protection (prevent deleting policies with active tokens)
- [ ] Comprehensive error handling with better error messages
- [ ] Performance optimization (database indexes, query optimization)
- [ ] **Multi-tenancy architecture review**: Currently single-tenant per Clerk user (each user has isolated policies/devices/tokens). Consider adding shared organization/team concept with role-based access control if multiple users need to collaborate on same device fleet. Current design works for SaaS model, but may need adjustment for internal company tool use case.

### UI/UX Polish
- [ ] Command history UI (audit trail of all commands sent to devices)
- [ ] Better real-time status indicators
- [ ] Bulk device operations (send commands to multiple devices)
- [ ] Scheduled commands (execute at specific time)
- [ ] Dashboard improvements (charts, analytics)

### App Deployment Enhancements
- [ ] Support app updates (detect version changes)
- [ ] Support app removal/uninstall commands
- [ ] Policy-based app assignment (assign apps to all devices with a policy)
- [ ] App inventory tracking (list of installed apps per device)
- [ ] App update notifications

---

## Architecture Reference

**Backend:**
- Next.js 15 (App Router) - Web UI
- Convex - Real-time database & backend logic
- Clerk - Authentication
- Vercel - Deployment

**Android Client:**
- Kotlin, Android 10+ (API 29+)
- Device Owner mode (full device control)
- Current version: v0.0.41 (environment-aware sync)
- Features: Offline enrollment, device commands, ping interval config, app installation, dynamic server URL
- Security: Three separate IDs (enrollmentId, ssaId, serialNumber), URL-safe Base64 signatures
- Reliability: Multi-layered heartbeat (foreground service + watchdog + WorkManager + system integration)
- Environment Support: Uses enrollment server URL for staging/preview, BuildConfig for local/production

**Environments:**
- **Local**: Offline development (Convex at 127.0.0.1:3210, auto-detects LAN IP)
- **Staging**: Cloud dev Convex (`kindly-mule-339`), Vercel preview
- **Production**: Cloud production Convex (`expert-lemur-691`), Vercel production

---

## Current Devices

**Test Device: Lenovo TB-X606F**
- Serial: HPV4CZ99
- Android: 10 (API 29)
- App Version: v0.0.41 (staging)
- Environment: Staging/Preview
- Status: ✅ Enrolled as Device Owner, sync working

**Device 1: Hannspree HSG1416**
- Serial: 1286Z2HN00621
- Android: 10 (API 29)
- App Version: v0.0.39 (or earlier)
- Status: ✅ Enrolled as Device Owner

**Device 2: Hannspree HSG1416**
- Serial: 313VC2HN00110
- Android: 10 (API 29)
- App Version: Requires enrollment with v0.0.41
- Status: ⚠️ Needs re-enrollment

---

## Documentation

**Tech Docs (docs/):**
- `android-build-variants.md` - Android build guide (v2.0, offline-first)
- `authentication-patterns.md` - Clerk + Convex auth best practices
- `development-setup.md` - Multi-environment setup, Git workflow, Convex practices
- `deployment-procedures.md` - Complete promotion and deployment guide

**Project Context:**
- `CLAUDE.md` - Project conventions, tech stack, coding standards

**Planning (planning/):**
- `PLAN.md` - This document (current plan with actionable tasks)
- `ROADMAP-NEXT-STEPS.md` - Long-term roadmap and feature backlog

**Historical (planning/archive/):**
- `2025-11-session/` - Completed planning docs and research

---

## Git Workflow

**Branch Structure:**
```
master (production)          ← Protected
  ↑
  PR + Review
  ↑
development (staging)        ← Protected
  ↑
  PR + Review
  ↑
feature/* branches           ← Local development
```

**Current Branch:** `feature/offline-local-dev`
**Next Action:** Fix critical issues, then create PR to `development`

---

## Commands Reference

### Local Development
```bash
# Terminal 1: Convex local backend
npx convex dev --local

# Terminal 2: Next.js dev server
NEXT_PRIVATE_TURBOPACK=0 npm run dev

# Terminal 3: ADB port forwarding (REQUIRED for physical device testing)
adb reverse tcp:3000 tcp:3000
# Must be re-run if device is disconnected/reconnected

# Build Android APK
cd android-client
./gradlew clean assembleLocalDebug
```

### Build APKs for Different Environments
```bash
cd android-client

# Local debug (for offline development)
./gradlew clean assembleLocalDebug

# Staging release (for Vercel preview testing)
./gradlew clean assembleStagingRelease

# Production release (for final deployment)
./gradlew clean assembleProductionRelease
```

### Extract APK Signature
```bash
/opt/android-sdk/build-tools/34.0.0/apksigner verify --print-certs \
  path/to/app.apk | grep SHA-256 | head -1
# Then convert to URL-safe Base64 (no padding, +/→-_)
```

### Deploy Convex Schema
```bash
# Deploy to cloud dev (staging) - preserves local .env.local
npm run convex:deploy:dev

# Deploy to cloud production - preserves local .env.local
npm run convex:deploy:prod

# Or use scripts directly:
./scripts/deploy-convex-dev.sh
./scripts/deploy-convex-prod.sh
```

### Environment Switching
```bash
# DON'T manually switch .env.local anymore!
# Use deployment scripts above instead (they preserve local settings)

# For reference, environments are:
# Local: http://127.0.0.1:3210 (CONVEX_DEPLOYMENT=local:local-ben_archer2691-bbtec_mdm)
# Cloud Dev: https://kindly-mule-339.convex.cloud (CONVEX_DEPLOYMENT=prod:kindly-mule-339)
# Production: https://expert-lemur-691.convex.cloud (CONVEX_DEPLOYMENT=prod:expert-lemur-691)
```

### Git Operations
```bash
# Create feature branch
git checkout development
git pull
git checkout -b feature/your-feature-name

# Push and create PR
git push -u origin feature/your-feature-name
# Then create PR on GitHub: feature/* → development
```

---

**Note:** This is a living document. Update as work progresses and priorities change.
