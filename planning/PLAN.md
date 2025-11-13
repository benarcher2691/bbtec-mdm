# Development Plan

**Branch:** `feature/offline-local-dev`
**Web Version:** 0.0.4
**Android Version:** 0.0.42
**Last Updated:** 2025-11-13

---

## Next Steps

### 🚀 Phase 2: Deploy to Production

**Prerequisites:** Staging validation complete ✅

**Steps:**
1. [ ] Build production APK (`./gradlew assembleProductionRelease`)
2. [ ] Extract production signature (should match staging: `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE`)
3. [ ] Create PR: `development` → `master`
4. [ ] Configure production environment variables in Vercel
5. [ ] Deploy Convex schema to production (`npm run convex:deploy:prod`)
6. [ ] Smoke test enrollment with production APK
7. [ ] Merge to master (triggers production deployment)

**Detailed procedures:** See [docs/deployment-procedures.md](../docs/deployment-procedures.md)

---

## Current Priorities

### Priority 1: QR Code Generation Review 📱
**Status:** NOT STARTED
**Expected Time:** 2-3 hours

**Tasks:**
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
**Status:** NOT STARTED (critical fixes complete)

**Optional Enhancements:**
- [ ] Add rate limiting on registration endpoints (design review needed)
- [ ] Review APK download security (public access vs. device auth)
- [ ] Add audit logging for admin actions (who did what when)
- [ ] Design review: Are public endpoints intentional? (registration, APK downloads)

**Current Security Posture:** ✅ Excellent
- All Convex functions properly protected with `ctx.auth.getUserIdentity()`
- Device token authentication working correctly
- No publicly exposed sensitive endpoints (debug endpoint removed 2025-11-13)

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
- Clerk - Authentication
- Vercel - Deployment

**Android Client:**
- Kotlin, Android 10+ (API 29+)
- Device Owner mode (full device control)
- Current version: v0.0.42
- Features: Offline enrollment, device commands, ping interval config, app installation, dynamic server URL
- Security: Three separate IDs (enrollmentId, ssaId, serialNumber), URL-safe Base64 signatures
- Reliability: Multi-layered heartbeat (foreground service + watchdog + WorkManager + system integration)
- Environment Support: Uses enrollment server URL for staging/preview, BuildConfig for local/production

**Environments:**
- **Local**: Offline development (Convex at 127.0.0.1:3210, auto-detects LAN IP)
- **Staging**: Cloud dev Convex (`kindly-mule-339`), Vercel preview
- **Production**: Cloud production Convex (`expert-lemur-691`), Vercel production

---

### Hybrid APK Signature Extraction

**How It Works:**

**Local Development (Android SDK available):**
1. Upload APK → Convex storage
2. Extraction endpoint downloads APK
3. Runs `apksigner verify --print-certs`
4. Extracts real SHA-256 signature
5. Converts to URL-safe Base64
6. ✅ Dynamic extraction for any APK

**Cloud Deployment (Vercel - no Android SDK):**
1. Upload APK → Convex storage
2. Extraction endpoint tries apksigner
3. Command fails (tools not found)
4. Falls back to environment detection:
   - Preview/Production → `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE` (release keystore)
   - Local/Unknown → `iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk` (debug keystore)
5. ✅ Returns correct signature for environment

**Key Insight:** Signatures are static per keystore
- Staging and production use the SAME keystore (`bbtec-mdm.keystore`)
- Signature doesn't change with version bumps
- Only changes if keystore is rotated (rare security event)

**When to Update Fallback Values:**
- ✅ **Never for version bumps** - Same keystore = same signature
- ✅ **Only when rotating keystores** - Rare security event
- ✅ **When adding new environment** - Different keystore = different signature

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
