# Development Plan

**Branch:** `feature/offline-local-dev`
**Web Version:** 0.0.5
**Android Version:** 0.0.43 (0.0.44 unreleased - heartbeat reliability fixes)
**Last Updated:** 2025-11-14

---

## Current Priorities

### Priority 0: ✅ Vercel Blob Storage Migration COMPLETE
**Status:** ✅ RESOLVED (2025-11-14)
**Impact:** ~90% cost reduction on bandwidth, no more Convex quota issues

**What Was Done:**
- ✅ Migrated APK storage from Convex File Storage to Vercel Blob Storage
- ✅ Implemented environment-aware variant tagging (local/staging/production)
- ✅ Automatic cleanup: only one APK per environment (max 3 total)
- ✅ APK downloads redirect to Vercel Blob CDN URLs (fast, efficient)
- ✅ Fixed package name bug (local uses base package `com.bbtec.mdm.client`)
- ✅ End-to-end tested: upload → metadata extraction → QR generation → device provisioning
- ✅ Device enrollment working perfectly from Vercel Blob

**Architecture:**
- APK binaries: Vercel Blob Storage (public CDN URLs)
- APK metadata: Convex (version, signature, blobUrl, variant, download count)
- Download flow: Client → Next.js API → 307 Redirect → Vercel Blob CDN

**Cost Impact:**
- Before: ~1.14 GB / 1 GB Convex bandwidth (14% over limit)
- After: Nearly zero Convex bandwidth (only metadata queries)
- Vercel Blob: 5 GB free tier (more than sufficient)

**Files Modified:**
- `convex/schema.ts` - Changed `storageId` to `blobUrl`, added `variant` field
- `convex/apkStorage.ts` - Variant-aware queries, blob URL handling
- `src/app/api/blobs/upload/route.ts` - NEW: Blob upload handler
- `src/app/api/blobs/delete/route.ts` - NEW: Blob deletion handler
- `src/app/api/apps/[storageId]/route.ts` - Redirect to blob URLs
- `src/app/actions/enrollment.ts` - Environment-aware variant selection
- `src/components/dpc-apk-manager.tsx` - Environment-based upload/deletion
- `package.json` - Added `@vercel/blob` dependency
- `.env.local` - Added `BLOB_READ_WRITE_TOKEN`

**Date Completed:** 2025-11-14

---

### Priority 1: Build New Local App 📱
**Status:** READY TO BUILD
**Expected Time:** 10 minutes

**What's Needed:**
- [ ] Build new `localDebug` APK with heartbeat reliability fixes (v0.0.44)
- [ ] Test fixes confirmed working (2025-11-14):
  - ✅ Try-catch-finally in polling loop prevents silent crashes
  - ✅ Service automatically recovers from network errors
  - ✅ 1-minute heartbeat interval working perfectly
  - ✅ Watchdog confirms consistent success
- [ ] Deploy to test device via `adb install -r`
- [ ] Optional: Verify long-term stability (24-hour test)

**Why Important:** Critical reliability fixes for heartbeat zombie state issue

**Build Command:**
```bash
cd android-client
./gradlew clean assembleLocalDebug
adb install -r app/build/outputs/apk/local/debug/app-local-debug.apk
```

---

### Priority 2: Policy Enforcement 🔐
**Status:** NOT STARTED (PolicyManager.kt exists but has placeholder logic)
**Expected Time:** 3-4 days

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

---

### Priority 3: Enhanced Device Info 📊
**Status:** NOT STARTED
**Expected Time:** 2-3 days

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

---

### Priority 4: Field Test Heartbeat Resilience ⏱️
**Status:** AWAITING FIELD TEST (v0.0.38 features included in v0.0.41)
**Expected Time:** 1-2 days (observation period)

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

---

### Priority 5: Security Improvements 🔒
**Status:** ✅ MAJOR IMPROVEMENTS COMPLETE (2025-11-13)

**Completed Security Enhancements:**
- [x] ✅ Removed all debug endpoints (env, test-apk, qr-json) - 2025-11-13
- [x] ✅ Removed insecure fallback registration (`/api/client/register`) - 2025-11-13
- [x] ✅ All devices now require QR code enrollment token (proper MDM flow) - 2025-11-13
- [x] ✅ Android client updated to enforce enrollment-only registration (v0.0.43)
- [x] ✅ APK downloads now require valid enrollment token (`/api/apps/[storageId]`) - 2025-11-13

**Optional Future Enhancements:**
- [ ] Add rate limiting on DPC registration endpoint (prevent token brute force)
- [ ] Add audit logging for admin actions (who did what when)

**Current Security Posture:** ✅ Production-Ready
- All Convex functions properly protected with `ctx.auth.getUserIdentity()`
- Device token authentication working correctly
- No publicly exposed sensitive endpoints
- All device registrations require valid enrollment tokens
- APK downloads require valid enrollment tokens (prevents unauthorized access)
- Proper user/policy assignment enforced at enrollment

---

## Future Enhancements (Lower Priority)

### Backend Improvements
- [ ] Fix token race condition (mark used BEFORE registration, not after)
- [ ] Policy deletion protection (prevent deleting policies with active tokens)
- [ ] Comprehensive error handling with better error messages
- [ ] Performance optimization (database indexes, query optimization)
- [ ] **Multi-tenancy architecture review**: Currently single-tenant per Clerk user (each user has isolated policies/devices/tokens). Consider adding shared organization/team concept with role-based access control if multiple users need to collaborate on same device fleet.

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

## Technical Reference

### Architecture

**Backend:**
- Next.js 15 (App Router) - Web UI
- Convex - Real-time database & backend logic
- Vercel Blob Storage - APK binary storage (CDN-backed)
- Clerk - Authentication
- Vercel - Deployment

**Android Client:**
- Kotlin, Android 10+ (API 29+)
- Device Owner mode (full device control)
- Current version: v0.0.43 (enforced enrollment-only registration)
- Features: Offline enrollment, device commands, ping interval config, app installation, dynamic server URL
- Security: Three separate IDs (enrollmentId, ssaId, serialNumber), URL-safe Base64 signatures, enrollment token required
- Reliability: Multi-layered heartbeat (foreground service + watchdog + WorkManager + system integration)
- Environment Support: Uses enrollment server URL for staging/preview, BuildConfig for local/production

**Environments:**
- **Local**: Offline development (Convex at 127.0.0.1:3210, auto-detects LAN IP)
- **Staging**: Cloud dev Convex (`kindly-mule-339`), Vercel preview
- **Production**: Cloud production Convex (`expert-lemur-691`), Vercel production

---

### APK Storage Architecture (Vercel Blob)

**Storage Flow:**

1. **Upload** (Client → Vercel Blob):
   - User uploads APK via web UI
   - Client calls `/api/blobs/upload` for auth token
   - Server validates user auth (Clerk)
   - Client uploads directly to Vercel Blob
   - Returns public blob URL

2. **Metadata Extraction** (Next.js → Convex):
   - Call `/api/apk/extract-signature` with blob URL
   - Downloads APK from blob URL
   - Extracts signature using `apksigner` (local) or fallback (cloud)
   - Parses package name, version from APK manifest
   - Saves metadata to Convex with environment variant

3. **Download** (Device → Vercel Blob CDN):
   - Device scans QR code with APK URL: `/api/apps/{apkId}?token={enrollmentToken}`
   - Next.js validates enrollment token
   - Returns 307 redirect to Vercel Blob CDN URL
   - Device downloads from CDN (fast, no bandwidth cost)

**Environment-Aware Variant Tagging:**
- Web app detects runtime environment (local/staging/production)
- Each uploaded APK tagged with environment variant
- Only one APK per environment stored (max 3 total)
- QR codes automatically use correct variant for environment

**Hybrid Signature Extraction:**
- **Local Development (Android SDK available):** Runs `apksigner verify --print-certs` for dynamic extraction
- **Cloud Deployment (Vercel - no Android SDK):** Falls back to known keystore signatures
  - Release keystore: `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE`
  - Debug keystore: `iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk`

**Key Benefits:**
- ✅ ~90% cost reduction vs Convex File Storage
- ✅ CDN-backed downloads (fast, global distribution)
- ✅ No bandwidth quota issues
- ✅ Public URLs (works with Android provisioning)
- ✅ Automatic cleanup (one APK per environment)

---

### Current Devices

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

**Migration Guides:**
- `VERCEL_BLOB_MIGRATION.md` - Complete guide for Vercel Blob storage setup and troubleshooting

**Project Context:**
- `CLAUDE.md` - Project conventions, tech stack, coding standards

**Planning (planning/):**
- `PLAN.md` - This document (current plan with actionable tasks)
- `ROADMAP-NEXT-STEPS.md` - Long-term roadmap and feature backlog
- `SECURITY-AUDIT-2025-11-12.md` - Security audit results

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
**Current Status:** All staging issues resolved, ready for production promotion

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
