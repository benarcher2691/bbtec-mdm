# BBTec MDM - Roadmap & Next Steps

**Last Updated:** 2025-11-07
**Current Status:** ✅ Device commands working, ping interval sync implemented, wipe command tested successfully

## Recent Achievements

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

**⚠️ Known Issues Discovered:**
- **Serial Number Display Bug:** Serial number no longer displayed in Device Management page (regression from 2025-11-06 commit) - currently shows Android ID instead
- **Wipe Status Not Updating:** After successful device wipe, web dashboard still shows "Factory reset pending" - needs status update logic when device goes offline permanently

### 2025-11-06: Hardware Serial Number Access (v0.0.24)

**✅ Fixed Hardware Serial Number Access**
- Problem: Both Serial Number and Android ID showed identical values (Android ID)
- Root Cause: `READ_PHONE_STATE` runtime permission not granted on Android 10+
- Solution: Auto-grant permission using `DevicePolicyManager.setPermissionGrantState()` in `MdmDeviceAdminReceiver.onEnabled()`
- Result: ✅ Serial Number: `1286Z2HN00621` | Android ID: `013c2736ecd4511d` (different values!)

## Roadmap - Priority Order

### 1. Device Management Commands 🎯 **[MOSTLY COMPLETE]**

**Status:** ✅ Core functionality working! Commands execute successfully, but status tracking needs refinement.

**What's Working:**
- [x] Android client: Poll for commands from backend (via `ApiClient.getCommands()`)
- [x] Android client: Execute wipe command using `DevicePolicyManager.wipeData()`
- [x] Android client: Execute lock command using `DevicePolicyManager.lockNow()`
- [x] Android client: Execute reboot command using `DevicePolicyManager.reboot()`
- [x] Android client: Report command execution status back to backend
- [x] Web UI: Show command execution status (pending)
- [x] Sync button in Android client for immediate command check

**What Needs Work:**
- [ ] Fix serial number display in Device Management page (regression)
- [ ] Web UI: Auto-update when device wipes (device goes offline permanently)
- [ ] Web UI: Better handling of completed/failed command states
- [ ] Add more commands: clear passcode, set kiosk mode, configure WiFi
- [ ] Command history/audit trail in web UI

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

### 2. Security Audit 🔒 **[HIGH PRIORITY - BEFORE PRODUCTION]**

**Status:** ⚠️ Not yet audited - critical before any production use

**What to Audit:**
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

### 3. App Deployment 📱

**Status:** Web UI can upload APKs to Convex storage, but devices can't receive/install them yet.

**What to Build:**
- [ ] Backend: Assign APKs to devices or policies
- [ ] Android client: Poll for assigned apps
- [ ] Android client: Download APK from Convex storage URL
- [ ] Android client: Silent install using `DevicePolicyManager.installExistingPackage()` or `PackageInstaller`
- [ ] Track installation status (downloading/installing/installed/failed)
- [ ] Support app updates and removal

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
- Current version: v0.0.27
- Signature: `53:CD:0E:1A:9E:3F:3A:38:C6:66:84:2A:98:94:CA:8E:B1:ED:DC:DC:F4:FB:0E:13:10:B3:03:8F:A7:1B:CE:21`
- Features: Device commands (wipe/lock/reboot), ping interval config, manual sync button

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

### Immediate (Bug Fixes)
1. **Fix serial number display bug** in Device Management page (regression from 2025-11-06)
2. **Fix wipe command status tracking** - web UI should detect when device goes offline after wipe

### High Priority (Security)
3. **Security audit** of all API endpoints and Convex functions (see section 2)
4. **Implement rate limiting** on device registration and command endpoints
5. **Add audit logging** for administrative actions

### Medium Priority (Features)
6. **App deployment system** - Silent APK installation on managed devices
7. **Policy enforcement** - Apply device restrictions from web dashboard
8. **Enhanced device info** - Battery, storage, network, installed apps
9. **Command history UI** - Show audit trail of all commands sent to devices

### Lower Priority (Polish)
10. **Error handling improvements** - Better error messages throughout
11. **Dashboard improvements** - Better real-time status indicators
12. **Documentation** - API documentation, deployment guide, user manual

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
