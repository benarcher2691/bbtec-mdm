# BBTec MDM - Roadmap & Next Steps

**Date:** 2024-11-06
**Current Status:** ✅ Device enrollment working, hardware serial number properly captured

## Today's Achievement

**Fixed Hardware Serial Number Access (v0.0.24)**
- Problem: Both Serial Number and Android ID showed identical values (Android ID)
- Root Cause: `READ_PHONE_STATE` runtime permission not granted on Android 10+
- Solution: Auto-grant permission using `DevicePolicyManager.setPermissionGrantState()` in `MdmDeviceAdminReceiver.onEnabled()`
- Result: ✅ Serial Number: `1286Z2HN00621` | Android ID: `013c2736ecd4511d` (different values!)

## Roadmap - Priority Order

### 1. Device Management Commands 🎯 **[HIGHEST PRIORITY - START HERE]**

**Status:** Backend infrastructure exists (deviceCommands table), UI has wipe button, but Android client doesn't handle commands yet.

**What to Build:**
- [ ] Android client: Poll for commands from backend
- [ ] Android client: Execute wipe command using `DevicePolicyManager.wipeData()`
- [ ] Android client: Report command execution status back to backend
- [ ] Web UI: Show command execution status (pending/success/failed)
- [ ] Add more commands: lock device, reboot, clear passcode

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

### 2. App Deployment 📱

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

### 3. Policy Enforcement 🔒

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

### 4. Enhanced Device Info 📊

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

### 5. Backend Improvements 🛠️

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
- Current version: v0.0.24
- Signature: `53:CD:0E:1A:9E:3F:3A:38:C6:66:84:2A:98:94:CA:8E:B1:ED:DC:DC:F4:FB:0E:13:10:B3:03:8F:A7:1B:CE:21`

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

## Decision: Start with Device Commands Tomorrow

**Why:**
1. Most visible feature (user already tried the wipe button)
2. Backend infrastructure already exists
3. Unlocks powerful device management capabilities
4. Relatively straightforward implementation
5. Can test end-to-end easily

**First Steps Tomorrow:**
1. Review existing `deviceCommands` Convex schema
2. Implement command polling in `ApiClient.kt`
3. Create `CommandExecutor.kt` for executing commands
4. Implement wipe command first (most critical)
5. Add command status reporting back to backend
6. Test with connected device

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
