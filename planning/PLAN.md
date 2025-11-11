# Development Plan

**Branch:** `feature/offline-local-dev`
**Web Version:** 0.0.4
**Android Version:** 0.0.39
**Last Updated:** 2025-11-11

---

## Current Status

### ✅ Just Completed
- **Offline-First Local Development** (feature/offline-local-dev)
  - Dynamic IP detection for local development
  - Environment-aware APK streaming (local streams, cloud redirects)
  - Cleartext HTTP support for local flavor
  - v1+v2 signing for certificate extraction
  - Package name consistency (no `.local` suffix)
  - Device enrollment working offline (HPV4CZ99 enrolled successfully)
  - Documentation updated (android-build-variants.md v2.0)

### 🎯 Ready to Promote
- Feature branch ready for PR to development
- All changes committed and pushed
- Documentation complete

---

## Next Steps - Promotion Path

### Phase 1: Merge to Development (Immediate)
**Goal:** Test offline-first feature in staging environment

**Actions:**
1. Create Pull Request on GitHub
   - Source: `feature/offline-local-dev`
   - Target: `development`
   - Following branch protection workflow

2. Test in Vercel Preview
   - Preview auto-deploys with cloud dev Convex (`kindly-mule-339`)
   - Test complete enrollment flow in staging
   - Verify dynamic IP detection works in cloud mode

3. Merge After Approval
   - Squash and merge to development
   - Delete feature branch

**Expected Time:** 1 day

---

### Phase 2: Merge to Production (After Staging Validation)
**Goal:** Deploy offline-first feature to production

**Actions:**
1. Create Pull Request on GitHub
   - Source: `development`
   - Target: `master`
   - Following branch protection workflow

2. Vercel Production Deploy
   - Auto-deploys to production
   - Uses cloud production Convex (`expert-lemur-691`)

3. Smoke Test
   - Test enrollment in production
   - Verify all environments working

**Expected Time:** 1 day (after staging validation)

---

## Future Work - Core Functionality

### Priority 1: Security Audit 🔒
**Status:** IN PROGRESS (command ownership ✅, enrollment/policy endpoints pending)

**What's Needed:**
- [ ] Audit `/api/dpc/register` endpoint (enrollment token validation)
- [ ] Audit `/api/client/commands` endpoint (device auth)
- [ ] Review all Convex functions for proper `ctx.auth.getUserIdentity()` checks
- [ ] Add rate limiting on registration endpoints
- [ ] Add audit logging for admin actions (who did what when)
- [ ] Test for data leakage across user boundaries

**Why Important:** Critical for production readiness and user data security

**Expected Time:** 2-3 days

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
- Current version: v0.0.39 (offline-first + resilience system)
- Features: Offline enrollment, device commands, ping interval config, app installation
- Security: Three separate IDs (enrollmentId, ssaId, serialNumber), URL-safe Base64 signatures
- Reliability: Multi-layered heartbeat (foreground service + watchdog + WorkManager + system integration)

**Environments:**
- **Local**: Offline development (Convex at 127.0.0.1:3210, auto-detects LAN IP)
- **Staging**: Cloud dev Convex (`kindly-mule-339`), Vercel preview
- **Production**: Cloud production Convex (`expert-lemur-691`), Vercel production

---

## Current Devices

**Device 1: Hannspree HSG1416**
- Serial: 1286Z2HN00621
- Android: 10 (API 29)
- App Version: v0.0.39 (or earlier)
- Status: ✅ Enrolled as Device Owner

**Device 2: Hannspree HSG1416**
- Serial: 313VC2HN00110
- Android: 10 (API 29)
- App Version: Requires enrollment with v0.0.39
- Status: ⚠️ Needs re-enrollment

---

## Documentation

**Tech Docs (docs/):**
- `android-build-variants.md` - Android build guide (v2.0, offline-first)
- `authentication-patterns.md` - Clerk + Convex auth best practices

**Project Context:**
- `CLAUDE.md` - Project conventions, tech stack, multi-environment workflow

**Planning (planning/):**
- `ROADMAP-NEXT-STEPS.md` - Long-term roadmap and feature backlog
- `PLAN-2025-11-11.md` - This document (active plan)

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
**Next Action:** Create PR to `development`

---

## Commands Reference

### Local Development
```bash
# Terminal 1: Convex local backend
npx convex dev --local

# Terminal 2: Next.js dev server
NEXT_PRIVATE_TURBOPACK=0 npm run dev

# Terminal 3: Build Android APK
cd android-client
./gradlew clean assembleLocalDebug
```

### Environment Switching
```bash
# Local → Cloud Dev
# Update .env.local:
NEXT_PUBLIC_CONVEX_URL=https://kindly-mule-339.convex.cloud
CONVEX_DEPLOYMENT=prod:kindly-mule-339

# Cloud Dev → Production
# Update .env.local:
NEXT_PUBLIC_CONVEX_URL=https://expert-lemur-691.convex.cloud
CONVEX_DEPLOYMENT=prod:expert-lemur-691
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

**Note:** This is a living document. Update as priorities change and features complete.
