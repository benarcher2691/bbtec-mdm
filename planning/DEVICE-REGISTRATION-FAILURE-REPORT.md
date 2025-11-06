# Device Registration Failure: Technical Investigation Report

**Date:** November 6, 2025
**Version:** v0.0.17 → v0.0.18
**Status:** ⚠️ CRITICAL - Device achieves Device Owner but never registers with backend

---

## Executive Summary

Android 10 devices successfully achieve Device Owner mode via QR code provisioning, but fail to register with the backend server. As a result:
- ✅ Device Owner status confirmed on User 0
- ❌ No API token saved to device
- ❌ Device does not appear in web UI device list
- ❌ Heartbeat and policy sync fail with "No API token" errors

The root cause remains unknown due to missing logs during the critical provisioning phase.

---

## Current Issue

### Symptoms

**Device Status (v0.0.17):**
```bash
$ adb shell dumpsys device_policy | grep -A5 "Device Owner"
Device Owner:
  admin=ComponentInfo{com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver}
  name=
  package=com.bbtec.mdm.client
  User ID: 0
```

**Error Logs After Boot:**
```
11-06 17:41:45.131  3068  3068 E ApiClient: Cannot send heartbeat: No API token
11-06 17:41:45.132  3068  3068 E ApiClient: Cannot send heartbeat: No API token
11-06 17:41:45.132  3068  3068 E ApiClient: Cannot get commands: No API token
```

**Web UI:**
- Device list: Empty
- No device record created in Convex database

### Expected Behavior

**Proper QR Provisioning Flow:**
1. Android Setup Wizard downloads and installs DPC APK
2. Sets DPC as Device Owner on User 0
3. Launches `PolicyComplianceActivity` with `ACTION_ADMIN_POLICY_COMPLIANCE` intent
4. Activity extracts `PROVISIONING_ADMIN_EXTRAS_BUNDLE` containing:
   - `enrollment_token`: Unique token from backend
   - `server_url`: Backend API URL
5. Activity saves token and URL to PreferencesManager
6. Activity calls `DeviceRegistration.registerDeviceWithToken(enrollmentToken)`
7. Backend receives registration request, validates token, creates device record
8. Backend returns API token for future heartbeats
9. Device saves API token
10. PollingService starts and sends heartbeat successfully

**What's Actually Happening:**
- Steps 1-2: ✅ Success (Device Owner achieved)
- Steps 3-9: ❓ Unknown (zero logs during provisioning)
- Step 10: ❌ Fails (no API token)

---

## Investigations Conducted

### Investigation 1: Test Mode Analysis

**Hypothesis:** QR code was generated in test mode, omitting enrollment token.

**Evidence:**
- User confirmed: "i was NOT in test mode"
- Git history shows test mode removal was committed in v0.0.17
- File: `src/components/qr-code-generator.tsx` (line 69):
  ```typescript
  const result = await createEnrollmentQRCode(selectedPolicyId, 3600, false, dpcType)
  ```
- Web deployment: v0.0.17 was pushed to GitHub and deployed to Vercel

**Conclusion:** ❌ Test mode is NOT the cause. QR code should include enrollment token.

---

### Investigation 2: PolicyComplianceActivity Log Analysis

**Hypothesis:** PolicyComplianceActivity crashed or failed to process extras bundle.

**Evidence:**
```bash
# System log shows activity was started
11-06 17:07:58.328   883   897 I ActivityTaskManager: START u0 {
  act=android.app.action.ADMIN_POLICY_COMPLIANCE
  pkg=com.bbtec.mdm.client
  cmp=com.bbtec.mdm.client/.PolicyComplianceActivity
  (has extras)
} from uid 10056
```

**Expected Logs (from PolicyComplianceActivity.kt:21-34):**
```kotlin
Log.d(TAG, "PolicyComplianceActivity started")
Log.d(TAG, "Admin extras received - Server URL: $serverUrl")
Log.d(TAG, "Enrollment token: ${enrollmentToken?.take(8)}...")
// ... more logs
```

**Actual Logs:** ZERO. No logs from PolicyComplianceActivity at all.

**Log Buffer Investigation:**
- Android logcat buffer: 256KB (rotates quickly)
- Provisioning occurred at 17:07:58
- First available logs from 17:10:27 onwards
- Critical provisioning logs were rotated out

**Crash Analysis:**
```bash
$ adb logcat -d -t '11-06 17:07:58.000' -t '11-06 17:08:10.000' | grep -E "(FATAL|AndroidRuntime|CRASH)"
# Result: No crashes found
```

**Conclusion:** ❓ Unknown if activity ran successfully or failed silently. Logs unavailable.

---

### Investigation 3: Device Protection Status

**Finding:** Device is a protected package due to Device Owner status.

**Evidence:**
```bash
$ adb shell am force-stop com.bbtec.mdm.client
W ActivityManager: Ignoring request to force stop protected package com.bbtec.mdm.client u0
```

**Implications:**
- ✅ Confirms Device Owner mode is working
- ✅ PollingService cannot be killed (keeps app process alive)
- ⚠️ Makes debugging difficult (can't restart app cleanly)

**Conclusion:** Device Owner is working correctly. This is expected behavior.

---

### Investigation 4: Serial Number Access Issues

**Hypothesis:** Registration failed due to permission errors accessing device serial.

**Code Analysis (DeviceRegistration.kt:112-117):**
```kotlin
// Note: DevicePolicyManager doesn't have getSerialNumber() - we need to use
// the special Device Owner privilege to request READ_PHONE_STATE at runtime
// For now, use Android ID which is stable and unique per device
val serialNumber = Settings.Secure.getString(
    context.contentResolver,
    Settings.Secure.ANDROID_ID
)
```

**Previous Error (v0.0.16 and earlier):**
```
SecurityException: getSerial: The user 10140 does not meet the requirements to access device identifiers
```

**Fix Applied:** Use `Settings.Secure.ANDROID_ID` instead of `Build.getSerial()`

**Conclusion:** ✅ Fixed in v0.0.17. No longer a blocking issue.

---

### Investigation 5: PollingService Background Start

**Previous Issue (v0.0.16):**
```
IllegalStateException: Not allowed to start service Intent { cmp=com.bbtec.mdm.client/.PollingService }:
app is in background uid
```

**Fix Applied (PollingService.kt:27-32):**
```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    // Android 8+ requires startForegroundService
    context.startForegroundService(Intent(context, PollingService::class.java))
} else {
    context.startService(Intent(context, PollingService::class.java))
}
```

**Conclusion:** ✅ Fixed in v0.0.17. Service starts successfully.

---

### Investigation 6: Alternative Activity Paths

**Code Review:** Three possible activities could handle provisioning:

1. **PolicyComplianceActivity** (`ACTION_ADMIN_POLICY_COMPLIANCE`)
   - Android 10+ calls this during provisioning
   - Should extract and save enrollment token
   - **Status:** Zero logs, unknown if called

2. **ProvisioningSuccessActivity** (`ACTION_PROVISIONING_SUCCESSFUL`)
   - Android 8.0+ uses this instead of `onProfileProvisioningComplete`
   - Should extract and save enrollment token
   - **Status:** No logs found in logcat

3. **MdmDeviceAdminReceiver.onProfileProvisioningComplete()**
   - Legacy path for Android < 8.0
   - Explicitly skipped on Android 8.0+ (ProvisioningSuccessActivity.kt:32-35)
   - **Status:** Correctly skipped on Android 10

**Log Search Results:**
```bash
$ adb logcat -d | grep -i "ProvisioningSuccess"
# Result: Empty

$ adb logcat -d | grep -i "ADMIN_POLICY_COMPLIANCE"
# Result: Empty (logs rotated out)

$ adb logcat -d | grep -i "PROVISIONING_SUCCESSFUL"
# Result: Empty
```

**Conclusion:** ❓ Unknown which activity was called. All logs missing.

---

### Investigation 7: QR Code Content Validation

**Code Analysis (enrollment.ts:117-121):**
```typescript
if (!testMode) {
  provisioningData["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"] = {
    "server_url": serverUrl,
    "enrollment_token": token.token,
  }
}
```

**QR Code Generation Flow:**
1. Web UI generates enrollment token in Convex database
2. Server action creates QR code JSON with `PROVISIONING_ADMIN_EXTRAS_BUNDLE`
3. QRCode library converts JSON to QR code image
4. User scans QR code during Android setup

**Evidence QR Code Should Be Correct:**
- ✅ Test mode disabled in v0.0.17
- ✅ Code explicitly includes extras bundle when `testMode === false`
- ✅ User confirmed test mode checkbox was not checked

**Missing Validation:**
- ❌ Never inspected actual QR code JSON content
- ❌ Never verified extras bundle is in QR code image
- ❌ Never confirmed Android received the bundle

**Conclusion:** ❓ Cannot confirm QR code contains enrollment token without inspection.

---

## Root Cause Analysis

### Known Facts

1. ✅ Device Owner mode achieved (confirmed via `dumpsys device_policy`)
2. ✅ DPC APK installed and signed correctly (v0.0.17)
3. ✅ `PolicyComplianceActivity` was started by system (ActivityTaskManager log)
4. ❌ No API token saved to device
5. ❌ No device registration in backend database
6. ❌ Zero logs from PolicyComplianceActivity

### Possible Causes

**Hypothesis A: QR Code Missing Enrollment Token**
- **Likelihood:** Low
- **Reasoning:** Code shows enrollment token should be included
- **Missing Evidence:** Never inspected actual QR code JSON

**Hypothesis B: PolicyComplianceActivity Crashing Immediately**
- **Likelihood:** Medium
- **Reasoning:** No logs at all suggests crash before first Log.d() call
- **Missing Evidence:** No crash logs in logcat

**Hypothesis C: Android Not Passing EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE**
- **Likelihood:** Medium
- **Reasoning:** Android 10 behavior may differ from TestDPC expectations
- **Missing Evidence:** Cannot see intent extras in logs

**Hypothesis D: Log Level Filtering on Release Builds**
- **Likelihood:** High
- **Reasoning:** Log.d() may be stripped or filtered on release APK
- **Missing Evidence:** Never used Log.e() for critical provisioning logs

---

## Proposed Solutions

### Solution 1: Enhanced Diagnostic Logging (v0.0.18) ✅ IMPLEMENTED

**Changes:**
- Replace all `Log.d()` with `Log.e()` in PolicyComplianceActivity
- Add try/catch blocks to capture exceptions
- Log intent details, extras bundle keys, all values
- Use visual markers (emojis, triple symbols) for critical events

**Implementation (PolicyComplianceActivity.kt):**
```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    try {
        Log.e(TAG, "═══ PolicyComplianceActivity STARTED ═══")
        Log.e(TAG, "Intent: ${intent?.toString()}")
        Log.e(TAG, "Intent action: ${intent?.action}")
        Log.e(TAG, "Intent extras: ${intent?.extras?.keySet()?.joinToString(", ")}")

        val adminExtras = intent.getBundleExtra(
            DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
        )

        if (adminExtras != null) {
            Log.e(TAG, "✅ Admin extras found!")
            Log.e(TAG, "Server URL: $serverUrl")
            Log.e(TAG, "Enrollment token: ${enrollmentToken?.take(8)}...")
            Log.e(TAG, "Admin extras keys: ${adminExtras.keySet()?.joinToString(", ")}")

            // Save to preferences
            if (serverUrl != null) {
                prefsManager.setServerUrl(serverUrl)
                Log.e(TAG, "✅ Server URL saved to preferences")
            }
            if (enrollmentToken != null) {
                prefsManager.setEnrollmentToken(enrollmentToken)
                Log.e(TAG, "✅ Enrollment token saved to preferences")
            }
        } else {
            Log.e(TAG, "❌ NO admin extras bundle in intent!")
            Log.e(TAG, "This means the QR code did not contain PROVISIONING_ADMIN_EXTRAS_BUNDLE")
        }

        performPolicyCompliance()
    } catch (e: Exception) {
        Log.e(TAG, "❌❌❌ EXCEPTION in onCreate: ${e.message}", e)
        e.printStackTrace()
        completeCompliance()
    }
}

private fun performPolicyCompliance() {
    try {
        Log.e(TAG, "═══ performPolicyCompliance STARTED ═══")

        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)

        if (isDeviceOwner) {
            Log.e(TAG, "✅✅✅ Device Owner mode confirmed!")
        } else {
            Log.e(TAG, "⚠️⚠️⚠️ Not Device Owner - may be Profile Owner instead")
        }

        val prefsManager = PreferencesManager(this)
        val enrollmentToken = prefsManager.getEnrollmentToken()
        val serverUrl = prefsManager.getServerUrl()

        Log.e(TAG, "Server URL from prefs: $serverUrl")
        Log.e(TAG, "Enrollment token from prefs: ${if (enrollmentToken != null) enrollmentToken.take(8) + "..." else "NULL"}")

        if (enrollmentToken != null && serverUrl != null) {
            Log.e(TAG, "🚀 Registering device with enrollment token...")
            DeviceRegistration(this).registerDeviceWithToken(enrollmentToken)

            Log.e(TAG, "🚀 Starting polling service...")
            PollingService.startService(this)

            Log.e(TAG, "🚀 Syncing policies...")
            PolicyManager(this).syncPolicies()

            Log.e(TAG, "✅✅✅ Device registration and policy sync complete")
        } else {
            Log.e(TAG, "❌❌❌ No enrollment token or server URL - skipping registration")
            Log.e(TAG, "This means the QR code did not include the enrollment token!")
        }

        completeCompliance()
    } catch (e: Exception) {
        Log.e(TAG, "❌❌❌ EXCEPTION in performPolicyCompliance: ${e.message}", e)
        e.printStackTrace()
        completeCompliance()
    }
}
```

**Why This Works:**
- `Log.e()` is never filtered on release builds
- Triple emojis make logs easy to spot
- Try/catch prevents silent failures
- Logs intent structure to verify extras bundle presence

**Deliverable:**
- ✅ APK built: `artifacts/apks/bbtec-mdm-client-0.0.18.apk`
- ✅ Signature: `53:CD:0E:1A:9E:3F:3A:38:C6:66:84:2A:98:94:CA:8E:B1:ED:DC:DC:F4:FB:0E:13:10:B3:03:8F:A7:1B:CE:21`
- ✅ Committed and pushed to GitHub

---

### Solution 2: QR Code Content Inspection 🔍 RECOMMENDED NEXT STEP

**Objective:** Verify QR code actually contains enrollment token.

**Method:**
```bash
# 1. Generate QR code in web UI
# 2. Use browser dev tools to inspect the result object
console.log(JSON.parse(atob(qrCode.split(',')[1]))) // Decode base64 QR data

# 3. Or scan QR code and inspect with Android adb
adb shell pm dump com.bbtec.mdm.client | grep -i "extra"
```

**Expected QR Code JSON:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2abc...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "53:CD:0E:1A:9E:3F:3A:38:C6:66:84:2A:98:94:CA:8E:B1:ED:DC:DC:F4:FB:0E:13:10:B3:03:8F:A7:1B:CE:21",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "tok_abc123..."
  }
}
```

**What to Verify:**
- ✅ `PROVISIONING_ADMIN_EXTRAS_BUNDLE` key exists
- ✅ `enrollment_token` is present and non-empty
- ✅ `server_url` is correct

---

### Solution 3: Fresh Enrollment Test with v0.0.18 🚀 READY TO EXECUTE

**Prerequisites:**
1. Upload v0.0.18 APK to web app (DPC Management page)
2. Generate fresh QR code with v0.0.18
3. Factory reset test device
4. Start logcat capture BEFORE scanning QR code

**Test Procedure:**
```bash
# 1. Start logcat capture
adb logcat -v time > /tmp/provision-v0.0.18.log &

# 2. Factory reset device (or use new device)

# 3. During Android setup, scan QR code

# 4. Wait for provisioning to complete

# 5. Stop logcat
killall adb

# 6. Search for diagnostic markers
grep "═══" /tmp/provision-v0.0.18.log
grep "✅✅✅" /tmp/provision-v0.0.18.log
grep "❌❌❌" /tmp/provision-v0.0.18.log
grep "🚀" /tmp/provision-v0.0.18.log
```

**Expected Successful Output:**
```
11-06 18:00:00.000  PolicyComplianceActivity: ═══ PolicyComplianceActivity STARTED ═══
11-06 18:00:00.010  PolicyComplianceActivity: Intent extras: android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE
11-06 18:00:00.020  PolicyComplianceActivity: ✅ Admin extras found!
11-06 18:00:00.030  PolicyComplianceActivity: Server URL: https://bbtec-mdm.vercel.app
11-06 18:00:00.040  PolicyComplianceActivity: Enrollment token: abcd1234...
11-06 18:00:00.050  PolicyComplianceActivity: ✅ Server URL saved to preferences
11-06 18:00:00.060  PolicyComplianceActivity: ✅ Enrollment token saved to preferences
11-06 18:00:00.070  PolicyComplianceActivity: ═══ performPolicyCompliance STARTED ═══
11-06 18:00:00.080  PolicyComplianceActivity: ✅✅✅ Device Owner mode confirmed!
11-06 18:00:00.090  PolicyComplianceActivity: 🚀 Registering device with enrollment token...
11-06 18:00:00.100  DeviceRegistration: Sending DPC registration request...
11-06 18:00:01.200  DeviceRegistration: DPC registration successful! Token saved.
11-06 18:00:01.210  PolicyComplianceActivity: 🚀 Starting polling service...
11-06 18:00:01.220  PolicyComplianceActivity: 🚀 Syncing policies...
11-06 18:00:01.230  PolicyComplianceActivity: ✅✅✅ Device registration and policy sync complete
```

**Expected Failure Output (if QR code missing token):**
```
11-06 18:00:00.000  PolicyComplianceActivity: ═══ PolicyComplianceActivity STARTED ═══
11-06 18:00:00.010  PolicyComplianceActivity: Intent extras: (empty or other keys)
11-06 18:00:00.020  PolicyComplianceActivity: ❌ NO admin extras bundle in intent!
11-06 18:00:00.030  PolicyComplianceActivity: This means the QR code did not contain PROVISIONING_ADMIN_EXTRAS_BUNDLE
11-06 18:00:00.040  PolicyComplianceActivity: ═══ performPolicyCompliance STARTED ═══
11-06 18:00:00.050  PolicyComplianceActivity: Enrollment token from prefs: NULL
11-06 18:00:00.060  PolicyComplianceActivity: ❌❌❌ No enrollment token or server URL - skipping registration
11-06 18:00:00.070  PolicyComplianceActivity: This means the QR code did not include the enrollment token!
```

---

### Solution 4: Alternative - Persistent Logging

**If logs still missing, implement persistent file logging:**

```kotlin
// Add to PolicyComplianceActivity
private fun logToFile(message: String) {
    try {
        val file = File(getExternalFilesDir(null), "provision.log")
        file.appendText("${System.currentTimeMillis()}: $message\n")
    } catch (e: Exception) {
        // Ignore
    }
}
```

**Retrieve logs:**
```bash
adb shell "cat /sdcard/Android/data/com.bbtec.mdm.client/files/provision.log"
```

---

## Recommended Action Plan

### Phase 1: Immediate Testing (v0.0.18)

1. **Upload v0.0.18 APK to web app**
   - Location: `artifacts/apks/bbtec-mdm-client-0.0.18.apk`
   - Verify signature checksum matches in Convex storage

2. **Generate fresh QR code**
   - Use BBTec MDM Client (not Test DPC)
   - Ensure test mode is OFF
   - Screenshot QR code for reference

3. **Factory reset device**
   - Or use fresh device

4. **Start logcat capture**
   ```bash
   adb logcat -v time > ~/logs/provision-v0.0.18-$(date +%Y%m%d-%H%M%S).log
   ```

5. **Scan QR code and provision**
   - Let Android complete setup
   - Wait for provisioning success screen

6. **Analyze logs**
   ```bash
   grep -E "(═══|✅|❌|🚀)" ~/logs/provision-v0.0.18-*.log
   ```

### Phase 2: QR Code Content Validation

If v0.0.18 logs show "❌ NO admin extras bundle":

1. **Inspect QR code JSON in browser dev tools**
2. **Verify enrollment token exists in database**
3. **Compare with working TestDPC QR code**

### Phase 3: Backend Validation

If v0.0.18 shows enrollment token present but registration fails:

1. **Check backend API logs** (Vercel deployment logs)
2. **Verify `/api/dpc/register` endpoint is receiving requests**
3. **Check Convex function logs for errors**

---

## Technical Specifications

### Device Under Test
- **Model:** Android 10 device
- **Serial:** 1286Z2HN00621
- **Android Version:** 10 (API 29)
- **Setup State:** Factory reset ready

### Software Versions
- **DPC APK:** v0.0.17 (current), v0.0.18 (enhanced logging)
- **Web App:** Deployed to Vercel (latest: v0.0.17 with test mode removal)
- **Backend:** Convex hosted database
- **Signature:** `53:CD:0E:1A:9E:3F:3A:38:C6:66:84:2A:98:94:CA:8E:B1:ED:DC:DC:F4:FB:0E:13:10:B3:03:8F:A7:1B:CE:21`

### Key Files Modified in v0.0.18
1. `android-client/app/src/main/java/com/bbtec/mdm/client/PolicyComplianceActivity.kt`
   - Enhanced error-level logging
   - Try/catch exception handling
   - Intent extras inspection

2. `android-client/app/build.gradle.kts`
   - Version bump: 17 → 18

### Git Commits
- **v0.0.17:** `166429f` - Test mode removal, serial number fix, PollingService fix
- **v0.0.18:** `122e612` - Enhanced diagnostic logging

---

## Success Criteria

### Successful Registration (Goal)
- ✅ PolicyComplianceActivity logs appear with "✅✅✅ Device Owner mode confirmed!"
- ✅ Enrollment token is received and saved
- ✅ Backend returns API token
- ✅ Device appears in web UI device list
- ✅ Heartbeat succeeds (no "No API token" errors)

### Diagnostic Success (Minimum)
- ✅ PolicyComplianceActivity logs are visible
- ✅ Can determine if `PROVISIONING_ADMIN_EXTRAS_BUNDLE` is present
- ✅ Can identify exact failure point in registration flow

---

## Appendix A: Related Files

### Android Client
- `/android-client/app/src/main/java/com/bbtec/mdm/client/PolicyComplianceActivity.kt`
- `/android-client/app/src/main/java/com/bbtec/mdm/client/ProvisioningSuccessActivity.kt`
- `/android-client/app/src/main/java/com/bbtec/mdm/client/DeviceRegistration.kt`
- `/android-client/app/src/main/java/com/bbtec/mdm/client/ApiClient.kt`
- `/android-client/app/src/main/java/com/bbtec/mdm/client/PreferencesManager.kt`

### Web App
- `/src/components/qr-code-generator.tsx`
- `/src/app/actions/enrollment.ts`
- `/convex/enrollmentTokens.ts`
- `/convex/deviceClients.ts`

### Backend API
- `/src/app/api/dpc/register/route.ts`
- `/src/app/api/client/heartbeat/route.ts`

---

## Appendix B: Comparison with TestDPC

TestDPC (Google's reference DPC) successfully achieves Device Owner and registers on the same device. Key differences:

| Aspect | TestDPC | BBTec MDM v0.0.17 | BBTec MDM v0.0.18 |
|--------|---------|-------------------|-------------------|
| Device Owner | ✅ User 0 | ✅ User 0 | ✅ User 0 |
| Logging Level | Unknown | Log.d() | Log.e() |
| Exception Handling | Unknown | None | Try/catch |
| Intent Extras Logging | Unknown | No | Yes |
| Registration | N/A (Google backend) | ❌ Fails | 🔍 Testing |

---

## Update: November 6, 2025 - Root Cause Found & Fixed (v0.0.21)

### Current Issue

**Status:** 🔍 PARTIAL SUCCESS - Enrollment token extracted successfully, but device not appearing in web UI

**Evidence from v0.0.21 Provisioning:**
```
E PolicyComplianceActivity: ✅ Admin extras found in PersistableBundle!
E PolicyComplianceActivity: Server URL: https://bbtec-mdm.vercel.app
E PolicyComplianceActivity: Enrollment token length: 36
E PolicyComplianceActivity: Enrollment token: 5ae72777-044...
E DeviceRegistration: Request JSON: {"enrollmentToken":"5ae72777-0449-44a6-47b5-812c4007cb1b","serialNumber":"cdfc758d1aa25303",...}
E DeviceRegistration: Sending DPC registration request to: https://bbtec-mdm.vercel.app/api/dpc/register
E DeviceRegistration: DPC registration failed: {"error":"Enrollment token already used"}
```

**Observations:**
1. ✅ Enrollment token successfully extracted (36 characters)
2. ✅ Registration request sent to backend with all required fields
3. ✅ Backend marks token as "used" (proven by retry error)
4. ❌ Device still does not appear in web UI device list
5. ⚠️ Success/failure response logs missing (use `Log.d()` which is filtered on release builds)

### Analysis

#### Root Cause #1: PersistableBundle Type Mismatch (FIXED ✅)

**Problem Identified (v0.0.18-v0.0.20):**

Android passes `PROVISIONING_ADMIN_EXTRAS_BUNDLE` as a `PersistableBundle`, not a regular `Bundle`. The original code attempted to extract it using:

```kotlin
// ❌ This ALWAYS returned null:
val adminExtras = intent.getBundleExtra(
    DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
)
```

Even though the intent contained the key, `getBundleExtra()` could not deserialize a `PersistableBundle`, resulting in:
- Intent extras showed key exists: ✅ `android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE`
- Bundle warning during extraction: ⚠️ `W/Bundle: at PolicyComplianceActivity.onCreate`
- Extraction result: ❌ `null`
- Enrollment token length: ❌ `0` (empty string)

**Evidence:**
```
11-06 19:48:17.545 E/PolicyComplianceActivity: Intent extras: android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE
11-06 19:48:17.546 W/Bundle: at PolicyComplianceActivity.onCreate(PolicyComplianceActivity.kt:28)
11-06 19:48:17.546 E/PolicyComplianceActivity: ❌ NO admin extras bundle in intent!
11-06 19:48:17.552 E/PolicyComplianceActivity: Enrollment token length: 0
```

**Solution Implemented (v0.0.21):**

Use `getParcelableExtra<PersistableBundle>()` to properly deserialize the bundle:

```kotlin
// ✅ This works:
val persistableExtras = intent.getParcelableExtra<android.os.PersistableBundle>(
    DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
)

if (persistableExtras != null) {
    val serverUrl = persistableExtras.getString("server_url")
    val enrollmentToken = persistableExtras.getString("enrollment_token")

    // Save to preferences
    prefsManager.setServerUrl(serverUrl)
    prefsManager.setEnrollmentToken(enrollmentToken)
}
```

**Result:**
```
11-06 20:13:33.797 E/DeviceRegistration: Enrollment token length: 36
11-06 20:13:33.797 E/DeviceRegistration: Enrollment token: 5ae72777-044...
11-06 20:13:33.799 E/DeviceRegistration: Request JSON: {"enrollmentToken":"5ae72777-0449-44a6-47b5-812c4007cb1b",...}
```

✅ **Fix Confirmed Working** - Enrollment token is now successfully extracted and sent to backend.

#### Root Cause #2: Backend Registration Status Unknown (INVESTIGATING 🔍)

**Problem:**

The enrollment token is marked as "used" by the backend (proven by "token already used" error on retry), which indicates the backend received and processed the registration request. However:

1. ❌ Device does not appear in web UI device list
2. ❓ Backend response (success/failure) is not visible in logs
3. ❓ Unknown if device record was created in Convex database

**Backend Flow Analysis (from `/src/app/api/dpc/register/route.ts`):**

```typescript
// 1. Validate enrollment token
const tokenData = await convex.query(api.enrollmentTokens.getByToken, { token: enrollmentToken })

// 2. Check if token is already used
if (tokenData.used) {
    return NextResponse.json({ error: 'Enrollment token already used' }, { status: 401 })
}

// 3. Register device in database
const result = await convex.mutation(api.deviceClients.registerDevice, {
    deviceId: serialNumber,
    serialNumber,
    androidId,
    model,
    manufacturer,
    androidVersion,
    isDeviceOwner: isDeviceOwner ?? true,
    userId: tokenData.userId, // ⚠️ Assigns device to token creator
})

// 4. Mark token as used
await convex.mutation(api.enrollmentTokens.markTokenUsed, {
    token: enrollmentToken,
    deviceId: serialNumber,
})

// 5. Return API token
return NextResponse.json({
    success: true,
    deviceId: serialNumber,
    apiToken: result.apiToken,
    policyId: tokenData.policyId,
})
```

**Key Observation:**

The token is marked as "used" (step 4), which means:
- ✅ Steps 1-2: Token validation passed
- ✅ Step 3: Device registration mutation was called
- ✅ Step 4: Token marked as used (THIS HAPPENED - proven by error)
- ❓ Step 5: Unknown if response was returned

**Possible Causes:**

1. **Device Created but User Mismatch:**
   - Device was assigned to `tokenData.userId` (the user who generated QR code)
   - Web UI is querying devices for a different user (auth mismatch?)
   - Device exists in Convex but not visible due to user filtering

2. **Registration Mutation Failed Silently:**
   - `api.deviceClients.registerDevice` threw an exception after token was marked used
   - Device record was not created
   - Error was not logged or returned

3. **API Token Not Saved to Device:**
   - Backend returned API token successfully
   - Device received response but didn't save token (though logs show "Cannot send heartbeat: No API token")
   - Issue: Success logs use `Log.d()` which are filtered on release builds

**Missing Diagnostic Information:**

```kotlin
// Line 155-173 in DeviceRegistration.kt
override fun onResponse(call: Call, response: Response) {
    Log.d(TAG, "DPC registration response: ${response.code}")  // ⚠️ Log.d() - not visible!
    if (response.isSuccessful) {
        val body = response.body?.string()
        Log.d(TAG, "DPC registration response body: $body")  // ⚠️ Log.d() - not visible!

        val result = gson.fromJson(body, RegistrationResponse::class.java)

        if (result.success && result.apiToken != null) {
            prefsManager.setDeviceId(serialNumber)
            prefsManager.setApiToken(result.apiToken)
            prefsManager.setRegistered(true)
            Log.d(TAG, "DPC registration successful! Token saved.")  // ⚠️ Log.d() - not visible!
        }
    } else {
        Log.e(TAG, "DPC registration failed: ${response.body?.string()}")  // ✅ Log.e() - visible!
    }
}
```

We can see error responses (`Log.e()`) but not success responses (`Log.d()`), making it impossible to determine if the device received an API token.

### Proposed Actions to Fix

#### Action 1: Check Backend Logs (IMMEDIATE) 🔍

**Objective:** Determine if device was actually created in the backend.

**Steps:**

1. **Check Vercel Deployment Logs:**
   - Navigate to: Vercel Dashboard → Project → Logs
   - Search for: `[DPC REGISTER]`
   - Time range: Around **20:11:50 UTC** (provisioning time)
   - Look for:
     - `[DPC REGISTER] SUCCESS: Device registered` → Device was created ✅
     - `[DPC REGISTER] ERROR` → Registration failed with error ❌

2. **Check Convex Database:**
   - Navigate to: Convex Dashboard → Data → `deviceClients` table
   - Search for: `serialNumber: cdfc758d1aa25303`
   - If found: Device exists but not showing in UI (user mismatch or query issue)
   - If not found: Registration mutation failed

**Expected Findings:**

- **Scenario A:** Device exists in Convex → User authentication/query issue
- **Scenario B:** Device does not exist → Registration mutation failed silently
- **Scenario C:** Registration logged error → Specific backend validation failure

#### Action 2: Add Error-Level Response Logging (v0.0.22) 🔧

**Objective:** Make all registration response logs visible on release builds.

**Implementation:**

```kotlin
// Change all Log.d() to Log.e() in DeviceRegistration.kt
override fun onResponse(call: Call, response: Response) {
    Log.e(TAG, "═══ REGISTRATION RESPONSE RECEIVED ═══")
    Log.e(TAG, "Response code: ${response.code}")

    if (response.isSuccessful) {
        val body = response.body?.string()
        Log.e(TAG, "✅ SUCCESS Response body: $body")

        val result = gson.fromJson(body, RegistrationResponse::class.java)

        if (result.success && result.apiToken != null) {
            prefsManager.setDeviceId(serialNumber)
            prefsManager.setApiToken(result.apiToken)
            prefsManager.setRegistered(true)
            Log.e(TAG, "✅✅✅ API token saved! Length: ${result.apiToken.length}")
            Log.e(TAG, "✅✅✅ Device registration COMPLETE")

            // Send immediate heartbeat
            ApiClient(context).sendHeartbeat()
        } else {
            Log.e(TAG, "❌ Success response but missing apiToken")
            Log.e(TAG, "Response success: ${result.success}, apiToken null: ${result.apiToken == null}")
        }
    } else {
        val errorBody = response.body?.string()
        Log.e(TAG, "❌❌❌ FAILED Response body: $errorBody")
    }
}

override fun onFailure(call: Call, e: java.io.IOException) {
    Log.e(TAG, "❌❌❌ NETWORK FAILURE: ${e.message}", e)
}
```

**Deliverable:** v0.0.22 APK with complete visibility into registration response.

#### Action 3: Verify User Authentication Flow 🔐

**Objective:** Ensure devices are being assigned to and queried by the correct user.

**Investigation:**

1. **Check Token Creator:**
   ```sql
   -- In Convex Data Explorer
   SELECT userId FROM enrollmentTokens WHERE token = '5ae72777-0449-44a6-47b5-812c4007cb1b'
   ```

2. **Check Device Assignment:**
   ```sql
   -- In Convex Data Explorer
   SELECT userId, serialNumber FROM deviceClients WHERE serialNumber = 'cdfc758d1aa25303'
   ```

3. **Check Web UI User:**
   - Verify logged-in user ID in browser dev tools
   - Check if `listDevices` query filters by current user

**Expected Finding:** Device was created but assigned to different userId than web UI is querying for.

**Fix if Confirmed:** Update device query to use correct user authentication context.

#### Action 4: Add Backend Error Handling 🛡️

**Objective:** Ensure registration errors are properly caught and returned.

**Implementation:**

```typescript
// In /src/app/api/dpc/register/route.ts
try {
    // Register device (creates new or updates existing)
    console.log(`[DPC REGISTER] Registering device in database...`)
    const result = await convex.mutation(api.deviceClients.registerDevice, {
        deviceId: serialNumber,
        serialNumber,
        androidId,
        model,
        manufacturer,
        androidVersion,
        isDeviceOwner: isDeviceOwner ?? true,
        userId: tokenData.userId,
    })

    console.log(`[DPC REGISTER] Device registered successfully:`, {
        deviceId: result.deviceId,
        hasApiToken: !!result.apiToken,
    })

    // ONLY mark token as used if registration succeeded
    await convex.mutation(api.enrollmentTokens.markTokenUsed, {
        token: enrollmentToken,
        deviceId: serialNumber,
    })

    console.log(`[DPC REGISTER] Token marked as used`)

} catch (error) {
    console.error(`[DPC REGISTER] ERROR during registration:`, error)
    // DO NOT mark token as used if registration failed
    throw error // Re-throw to be caught by outer try/catch
}
```

**Rationale:** Current code marks token as "used" even if device registration fails, preventing retry.

### Recommended Next Steps

**Priority 1 (Immediate):**
1. ✅ Check Vercel logs for `[DPC REGISTER]` entries around 20:11:50
2. ✅ Check Convex database for device with serialNumber `cdfc758d1aa25303`
3. ✅ Determine if device exists but is not visible in UI

**Priority 2 (If device not in database):**
1. 🔧 Build v0.0.22 with error-level response logging
2. 🔧 Update backend to only mark token as used after successful registration
3. 🔧 Add retry logic for transient backend failures

**Priority 3 (If device exists but not visible):**
1. 🔐 Verify user authentication flow
2. 🔐 Check if device query filters are correct
3. 🔐 Fix user assignment or query logic

### Technical Specifications

**Current Environment:**
- **Device:** Android 10 (HSG1416, Hannspree)
- **Serial Number:** `cdfc758d1aa25303`
- **DPC Version:** v0.0.21
- **Enrollment Token:** `5ae72777-0449-44a6-47b5-812c4007cb1b`
- **Device Owner:** ✅ Confirmed (User 0)
- **First Install:** 2025-11-06 20:11:30
- **Provisioning Time:** 2025-11-06 20:11:49

**Key Files Modified:**
- `v0.0.21`: PolicyComplianceActivity.kt (PersistableBundle fix)
- `v0.0.22` (proposed): DeviceRegistration.kt (error-level response logging)

**Git Commits:**
- `106815f` - v0.0.21: PersistableBundle fix (WORKING ✅)
- Next: v0.0.22 with enhanced response logging

---

## Conclusion

**Major Breakthrough:** The root cause of enrollment token extraction failure has been identified and fixed in v0.0.21. Android uses `PersistableBundle` instead of regular `Bundle` for provisioning extras, which required using `getParcelableExtra<PersistableBundle>()` instead of `getBundleExtra()`.

**Current Status:** Enrollment token extraction is now working perfectly (36-character token successfully extracted and sent to backend). However, devices are not appearing in the web UI despite the backend marking tokens as "used", which indicates registration was at least partially processed.

**Next Critical Step:** Check backend logs and Convex database to determine if devices are being created but not visible due to user authentication issues, or if the registration mutation is failing silently after the token is marked as used.

---

**Report Prepared By:** Claude Code
**Last Updated:** November 6, 2025 (20:15 UTC)
**Document Version:** 2.0
