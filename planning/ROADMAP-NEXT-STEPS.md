# BBTec MDM - Roadmap & Next Steps

**Last Updated:** 2025-11-07
**Current Status:** ✅ Production-ready device commands with callback-based handshake, app installation tested end-to-end, wipe device verified with auto-delete

## Recent Achievements

### 2025-11-07: Device Commands Production Hardening (v0.0.30-v0.0.33)

**🎯 CRITICAL BUG FIXES - App Installation & Wipe Device Command**

**Problems Identified:**
- App installation caused "bbtec-mdm Client keeps stopping" crash
- Serial number showing Android ID due to race condition
- Wipe command status never reached backend (web UI didn't update)
- NetworkOnMainThreadException causing silent failures

**Solutions Implemented:**
- ✅ **v0.0.30: Fixed NetworkOnMainThreadException in ApkInstaller** - Moved network calls to background threads
- ✅ **v0.0.31: Fixed serial number capture** - Grant READ_PHONE_STATE permission BEFORE device registration
- ✅ **v0.0.32: Added comprehensive logging** - Enhanced debugging for command processing
- ✅ **v0.0.33: Callback-based status reporting** - Async .enqueue() with 10s timeouts and confirmation handshake

**Callback Handshake Pattern (v0.0.33):**
```kotlin
// Before wiping, wait for backend confirmation
apiClient.reportCommandStatus(commandId, "completed", null) { success ->
    if (success) {
        // Backend confirmed receipt - SAFE TO WIPE
        policyManager.wipeDevice()
    } else {
        // Backend unreachable - ABORT and retry later
        Log.e(TAG, "Backend did not confirm - ABORTING wipe for safety")
    }
}
```

**Testing Results:**
- ✅ **App Installation (99MB APK)**: Download → Install → Status reported (HTTP 200)
- ✅ **Wipe Device**: Backend confirmation → Factory reset → Device auto-deleted → UI updated

**Technical Benefits:**
- Network operations now asynchronous with proper error handling
- 10-second timeouts prevent indefinite hangs
- Wipe command only executes after backend confirmation
- Serial number race condition eliminated by permission timing
- Comprehensive logging for production debugging

**Files Modified:**
- `android-client/app/src/main/java/com/bbtec/mdm/client/ApiClient.kt` - Async callbacks with timeout handling
- `android-client/app/src/main/java/com/bbtec/mdm/client/ApkInstaller.kt` - Background thread for status reporting
- `android-client/app/src/main/java/com/bbtec/mdm/client/MainActivity.kt` - Callback-based wipe confirmation
- `android-client/app/src/main/java/com/bbtec/mdm/client/PollingService.kt` - Callback-based wipe confirmation
- `android-client/app/src/main/java/com/bbtec/mdm/client/ProvisioningSuccessActivity.kt` - Permission grant timing fix

**Production Readiness:**
- ✅ No crashes during app installation
- ✅ Network timeouts handled gracefully
- ✅ Wipe device tested successfully with auto-delete
- ✅ Serial number properly captured and displayed
- ✅ Comprehensive logging for troubleshooting

---

### 2025-11-07: Security Hardening - Android ID Device Identification (v0.0.29)

**🔒 CRITICAL SECURITY FIX - Device Identification & Command Ownership**

**Problem Identified:**
- Devices were identified by serial number (doesn't change on factory reset)
- No ownership verification on command status updates
- Device A could maliciously manipulate Device B's commands
- Wiped devices could re-register with stale credentials

**Solution Implemented:**
- ✅ **Switched to Android ID as primary device identifier** (changes on factory reset)
- ✅ **Added command ownership verification** to prevent cross-device attacks
- ✅ **Auto-delete device records** when wipe command completes
- ✅ **Serial number kept for admin reference only**

**Security Benefits:**
- ✅ Wiped devices automatically disconnected (new Android ID after factory reset)
- ✅ Cross-device command manipulation prevented by ownership verification
- ✅ Natural enrollment separation - each factory reset starts fresh
- ✅ Self-healing security model - no stale credentials possible
- ✅ No admin intervention needed after wipe

**Technical Changes:**
- `convex/deviceClients.ts`: registerDevice now uses androidId as primary deviceId
- `convex/deviceCommands.ts`: Added authenticatedDeviceId verification to updateCommandStatus
- `src/app/api/dpc/register/route.ts`: Pass androidId as device identifier
- `src/app/api/client/command-status/route.ts`: Pass authenticated device ID for ownership verification

**Breaking Change:** Existing enrolled devices need re-enrollment (acceptable for test environment)

**Files Modified:**
- Backend mutations: Device registration, command status updates
- API routes: DPC registration, command status reporting
- Security pattern: All device commands now verify ownership before execution

---

### 2025-11-07: Applications Feature Accessibility (v0.0.28)

**✅ Made App Deployment Feature Accessible**
- **Discovery:** Complete app deployment implementation existed but was hidden from UI
- **Changes:**
  - Added "Applications" link to sidebar navigation (Management section)
  - Added "Install App" button to device detail view
  - Created install dialog with app selection UI
  - Implemented handleInstallApp function

**What's Now Working:**
- ✅ Upload APKs from web dashboard (already working)
- ✅ APKs stored in Convex storage (already working)
- ✅ Install apps to devices from web UI (newly accessible)
- ✅ Android client: Download and silent install APKs (already implemented)
- ✅ Installation status tracking (pending/executing/completed/failed)

**Full App Deployment Flow:**
1. Admin uploads APK via Applications page → stored in Convex
2. Admin selects device → clicks "Install App" → selects app
3. Install command created in backend
4. Device polls, receives install command
5. Device downloads APK from Convex storage URL
6. Silent installation via PackageInstaller API (Device Owner mode)
7. Status reported back to backend

**Result:** App deployment feature is now fully functional and accessible!

---

### 2025-11-07: Device Wipe Auto-Delete & Serial Number Fix (v0.0.28)

**✅ Auto-Delete Device After Wipe**
- Devices now automatically deleted from database when wipe command completes
- Benefits:
  - Device disappears from UI immediately
  - Re-enrollment creates fresh record (no inherited settings)
  - No orphaned wiped devices in database
  - Combined with Android ID security: wiped device can't report again

**✅ Fixed Serial Number Update Bug**
- Serial number now properly updated during device re-registration
- Fixes regression where serial wasn't being stored on re-enrollment

---

### 2025-11-07: Ping Interval & Device Commands (v0.0.27)

**✅ Bidirectional Ping Interval Configuration**
- Feature: Set ping interval (1-180 minutes) from both web dashboard AND Android client
- Implementation:
  - Web → Device: Updates automatically on next heartbeat
  - Device → Web: Real-time reactive updates using Convex
- API: New `/api/client/ping-interval` endpoint with device auth
- Mutation: `updatePingIntervalFromDevice` (no user auth, uses API token)
- UI: Inline editor with validation in web dashboard, settings section in Android client
- Result: ✅ Fully bidirectional, real-time synchronized

**✅ Device Wipe Command - End-to-End Testing**
- Tested complete wipe flow with 3-minute ping interval
- Device successfully received and executed factory reset via pull-based polling
- Timing: ~21 seconds from web button click to device wipe (fortunate poll timing)
- Confirmed: Pull-based architecture works correctly, devices poll at configured intervals
- Commands processed: wipe, lock, reboot (all implemented in Android client)

**⚠️ Known Issues (RESOLVED in v0.0.28-v0.0.29):**
- ~~Serial Number Display Bug~~ - ✅ **FIXED in v0.0.28**: Serial number now properly stored and updated
- ~~Wipe Status Not Updating~~ - ✅ **FIXED in v0.0.28**: Device auto-deleted when wipe completes
- ~~Security Vulnerability~~ - ✅ **FIXED in v0.0.29**: Android ID-based identification with ownership verification

### 2025-11-06: Hardware Serial Number Access (v0.0.24)

**✅ Fixed Hardware Serial Number Access**
- Problem: Both Serial Number and Android ID showed identical values (Android ID)
- Root Cause: `READ_PHONE_STATE` runtime permission not granted on Android 10+
- Solution: Auto-grant permission using `DevicePolicyManager.setPermissionGrantState()` in `MdmDeviceAdminReceiver.onEnabled()`
- Result: ✅ Serial Number: `1286Z2HN00621` | Android ID: `013c2736ecd4511d` (different values!)

## Roadmap - Priority Order

### 1. Device Management Commands 🎯 **[COMPLETE]**

**Status:** ✅ Fully working! Commands execute successfully with proper security and status tracking.

**What's Working:**
- [x] Android client: Poll for commands from backend (via `ApiClient.getCommands()`)
- [x] Android client: Execute wipe command using `DevicePolicyManager.wipeData()`
- [x] Android client: Execute lock command using `DevicePolicyManager.lockNow()`
- [x] Android client: Execute reboot command using `DevicePolicyManager.reboot()`
- [x] Android client: Report command execution status back to backend
- [x] Web UI: Show command execution status (pending/executing/completed/failed)
- [x] Sync button in Android client for immediate command check
- [x] Serial number properly stored and displayed (v0.0.28)
- [x] Device auto-deleted after wipe completes (v0.0.28)
- [x] Command ownership verification to prevent cross-device attacks (v0.0.29)

**What Could Be Added (Future Enhancements):**
- [ ] Add more commands: clear passcode, set kiosk mode, configure WiFi
- [ ] Command history/audit trail in web UI
- [ ] Scheduled commands (execute at specific time)
- [ ] Bulk commands (send to multiple devices)

**Technical Details:**
- Backend already has `deviceCommands` table in Convex
- Use existing polling mechanism (ApiClient.kt) to check for pending commands
- Device Owner powers needed: `DevicePolicyManager.wipeData()`, `DevicePolicyManager.lockNow()`

**Files to Modify:**
- `android-client/app/src/main/java/com/bbtec/mdm/client/ApiClient.kt` - Add command polling
- `android-client/app/src/main/java/com/bbtec/mdm/client/CommandExecutor.kt` - New file for command execution
- `convex/deviceCommands.ts` - Add command status updates
- `src/components/device-list-table.tsx` - Show command status in UI

**Expected Flow:**
1. User clicks "Wipe Device" in web UI
2. Backend creates command record with `type: "wipe"`, `status: "pending"`
3. Android client polls, sees pending wipe command
4. Executes `dpm.wipeData(DevicePolicyManager.WIPE_EXTERNAL_STORAGE)`
5. Device factory resets immediately
6. (Optional) Before wipe, client reports `status: "executing"`

---

### 2. Security Audit 🔒 **[IN PROGRESS]**

**Status:** ⚠️ Major security improvements completed (v0.0.29), additional review needed before production

**✅ Security Improvements Completed:**
- [x] **Device Identification Security (v0.0.29):**
  - ✅ Switched from serial number to Android ID (changes on factory reset)
  - ✅ Added command ownership verification to prevent cross-device attacks
  - ✅ Verified `command.deviceId === authenticatedDeviceId` before operations
  - ✅ Auto-delete wiped devices to prevent stale credentials

- [x] **Command Status Security (v0.0.29):**
  - ✅ `/api/client/command-status` now passes authenticated device ID
  - ✅ `deviceCommands.updateCommandStatus` verifies ownership before execution
  - ✅ Device A cannot manipulate Device B's commands

**What Still Needs Audit:**
- [ ] **API Endpoints:** Review all `/api/*` routes for proper authentication and authorization
  - Check device authentication (API token validation)
  - Check user authentication (Clerk session validation)
  - Verify input validation and rate limiting
  - Review error messages (don't leak sensitive info)

- [ ] **Convex Functions:** Review all queries/mutations for proper protection
  - Verify all functions call `ctx.auth.getUserIdentity()` for user auth
  - Check device-scoped operations filter by deviceId/userId
  - Verify no functions leak data across user boundaries
  - Review all functions that accept IDs (prevent unauthorized access)

- [ ] **Device API Endpoints (No User Auth):**
  - `/api/client/heartbeat` - Device token auth only ✅
  - `/api/client/ping-interval` - Device token auth only ✅
  - `/api/client/commands` - Device token auth only (needs verification)
  - `/api/client/command-status` - Device token auth + ownership verification ✅ (v0.0.29)
  - `/api/dpc/register` - Enrollment token auth (needs verification)

- [ ] **Web Dashboard Endpoints (User Auth Required):**
  - All Convex queries/mutations called from web UI
  - Device management operations (wipe, lock, reboot)
  - Policy management operations
  - Company user management operations
  - Enrollment token generation

**Files to Audit:**
- `src/app/api/client/*` - Device API routes
- `src/app/api/dpc/*` - Enrollment API routes
- `src/lib/auth-device.ts` - Device authentication logic
- `convex/deviceClients.ts` - Device management functions
- `convex/deviceCommands.ts` - Command management functions
- `convex/policies.ts` - Policy management functions
- `convex/companyUsers.ts` - Company user functions
- `convex/enrollmentTokens.ts` - Token management functions

**Security Principles:**
1. Never trust client input - always validate
2. All Convex functions must check auth unless explicitly public
3. Device operations must verify device ownership
4. User operations must verify user ownership
5. Enrollment tokens must be single-use and expire
6. API tokens must be stored securely (not logged)
7. Rate limit all write operations
8. Audit log all administrative actions

---

### 3. App Deployment 📱 **[COMPLETE]**

**Status:** ✅ Fully functional! End-to-end app deployment working (made accessible in v0.0.28)

**What's Working:**
- [x] Web UI: Upload APKs to Convex storage
- [x] Web UI: Applications page in sidebar navigation (v0.0.28)
- [x] Web UI: Install App button in device detail view (v0.0.28)
- [x] Backend: Create install commands for devices
- [x] Android client: Poll for install commands
- [x] Android client: Download APK from Convex storage URL
- [x] Android client: Silent install using PackageInstaller API (Device Owner mode)
- [x] Track installation status (pending/downloading/installing/completed/failed)

**What Could Be Added (Future Enhancements):**
- [ ] Support app updates (detect version changes)
- [ ] Support app removal/uninstall commands
- [ ] Policy-based app assignment (assign apps to all devices with a policy)
- [ ] App inventory tracking (list of installed apps per device)
- [ ] App update notifications

**Technical Details:**
- Use Device Owner API for silent installation (no user prompts)
- `DevicePolicyManager.setApplicationHidden()` to manage app visibility
- Store APKs in Convex storage (already working)
- Need to handle large file downloads efficiently

**Files to Create/Modify:**
- `convex/appAssignments.ts` - New schema for device-to-app mappings
- `android-client/app/src/main/java/com/bbtec/mdm/client/AppInstaller.kt` - Already exists, enhance it
- `src/app/apps/assign/page.tsx` - New UI for app assignment

---

### 4. Policy Enforcement 🔒

**Status:** Policies can be created and assigned to devices, but Android client doesn't enforce them.

**What to Build:**
- [ ] Android client: Fetch assigned policy from backend
- [ ] Android client: Apply device restrictions using `DevicePolicyManager`
- [ ] Enforce: Password requirements, camera disable, USB restrictions, etc.
- [ ] Report compliance status to backend
- [ ] Handle policy updates (re-sync and re-apply)

**Technical Details:**
- `PolicyManager.kt` already exists but only has placeholder logic
- Use `DevicePolicyManager` APIs:
  - `setCameraDisabled()`
  - `setPasswordQuality()`, `setPasswordMinimumLength()`
  - `addUserRestriction()` for USB, screenshot, etc.
- Need to track which policies are currently applied

**Files to Modify:**
- `android-client/app/src/main/java/com/bbtec/mdm/client/PolicyManager.kt` - Implement actual policy enforcement
- `convex/deviceClients.ts` - Add compliance status fields
- `src/components/device-list-table.tsx` - Show compliance status

---

### 5. Enhanced Device Info 📊

**Status:** Currently only showing basic info (model, manufacturer, version, serial, Android ID)

**What to Add:**
- [ ] Battery level and charging status
- [ ] Storage usage (total/used/free)
- [ ] Network info (WiFi SSID, IP address, cellular signal)
- [ ] Location tracking (if needed)
- [ ] List of installed apps
- [ ] Last known location
- [ ] Device health metrics

**Technical Details:**
- Use `BatteryManager` for battery info
- Use `StatFs` for storage info
- Use `WifiManager`, `TelephonyManager` for network info
- Send in heartbeat payload to minimize API calls

**Files to Modify:**
- `android-client/app/src/main/java/com/bbtec/mdm/client/ApiClient.kt` - Enhanced heartbeat payload
- `convex/deviceClients.ts` - Add new fields to schema
- `src/components/device-list-table.tsx` - Display new info in device detail view

---

### 6. Backend Improvements 🛠️

**Status:** Core functionality working, but technical review identified some issues

**What to Fix:**
- [ ] Token race condition: Mark token as used BEFORE device registration (not after)
- [ ] Policy deletion protection: Prevent deleting policies with active unused enrollment tokens
- [ ] Audit logging: Track who performed which actions when
- [ ] Error handling: Better error messages and retry logic
- [ ] Rate limiting: Prevent abuse of registration endpoints

**Reference:**
- See `planning/TECHNICAL-REVIEW-b44a20b.md` for detailed analysis

**Files to Modify:**
- `src/app/api/dpc/register/route.ts` - Fix token race condition
- `convex/policies.ts` - Add deletion protection
- `convex/auditLog.ts` - New schema for audit trail

---

## Current Architecture

**Backend:**
- Next.js 15 (App Router) - Web UI
- Convex - Real-time database & backend logic
- Clerk - Authentication
- Vercel - Deployment

**Android Client:**
- Kotlin, Android 10+ (API 29+)
- Device Owner mode (full device control)
- Current version: v0.0.33 (production-ready with callback-based status reporting)
- Signature: `53:CD:0E:1A:9E:3F:3A:38:C6:66:84:2A:98:94:CA:8E:B1:ED:DC:DC:F4:FB:0E:13:10:B3:03:8F:A7:1B:CE:21`
- Features: Device commands (wipe/lock/reboot), ping interval config, manual sync button, app installation
- Security: Android ID-based device identification (changes on factory reset)
- Reliability: Async network operations with 10s timeouts, callback-based wipe confirmation

**Enrollment Flow:**
1. Admin generates QR code (includes enrollment token, APK download URL)
2. Factory reset device, scan QR during setup
3. Device downloads BBTec MDM client APK
4. Android provisions app as Device Owner
5. App extracts enrollment token from provisioning intent
6. App registers with backend using token
7. Backend assigns policy and returns API token
8. Device polls for commands and policy updates

---

## Next Steps - Recommended Priority

### ✅ Recently Completed (v0.0.28-v0.0.29)
1. ~~Fix serial number display bug~~ - ✅ **DONE** (v0.0.28)
2. ~~Fix wipe command status tracking~~ - ✅ **DONE** (v0.0.28)
3. ~~Critical security fixes~~ - ✅ **DONE** (v0.0.29): Android ID device identification + ownership verification
4. ~~App deployment system accessibility~~ - ✅ **DONE** (v0.0.28): Made Applications feature accessible in UI

### High Priority (Security & Reliability)
1. **Complete security audit** of all API endpoints and Convex functions (see section 2)
   - Device command endpoints verified ✅
   - Still need: enrollment, policy management, user management endpoints
2. **Implement rate limiting** on device registration and command endpoints
3. **Add audit logging** for administrative actions (who did what when)
4. **Re-enroll test devices** with new Android ID-based system (breaking change from v0.0.29)

### Medium Priority (Features)
5. **Policy enforcement** - Apply device restrictions from web dashboard
   - PolicyManager.kt exists but needs implementation
   - Device restrictions: camera, USB, screenshots, password requirements
6. **Enhanced device info** - Battery, storage, network, installed apps
   - Send in heartbeat payload to minimize API calls
7. **Command history UI** - Show audit trail of all commands sent to devices
8. **App updates and removal** - Enhance app deployment with update detection

### Lower Priority (Polish)
9. **Error handling improvements** - Better error messages throughout
10. **Dashboard improvements** - Better real-time status indicators
11. **Documentation** - API documentation, deployment guide, user manual
12. **Backend improvements** - Fix token race condition, policy deletion protection (see TECHNICAL-REVIEW)

---

## Resources

**Key Documentation:**
- Android Management API: https://developers.google.com/android/management
- DevicePolicyManager: https://developer.android.com/reference/android/app/admin/DevicePolicyManager
- Device Owner provisioning: https://developer.android.com/work/dpc/qr-code

**Key Files:**
- Backend: `convex/deviceCommands.ts`, `convex/deviceClients.ts`
- Android: `ApiClient.kt`, `DeviceRegistration.kt`, `PolicyManager.kt`
- UI: `src/components/device-list-table.tsx`

**Current Device:**
- Model: Hannspree HSG1416
- Serial: 1286Z2HN00621
- Android: 10 (API 29)
- Status: ✅ Enrolled as Device Owner

---

## Notes

- All API calls must use proper authentication (Clerk + Convex)
- Device Owner permissions are powerful - use responsibly
- Always log command executions for audit trail
- Test wipe command carefully (it WILL erase the device!)
- Consider adding confirmation dialogs for destructive actions
