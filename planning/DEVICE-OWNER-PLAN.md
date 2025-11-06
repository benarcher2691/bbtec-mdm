# Plan: Achieve Device Owner Status on Android 10

**Date:** 2025-11-05
**Status:** ❌ Phase 2 FAILED - Investigating Fallback Options
**Goal:** Make BBTec MDM provision as Device Owner (User 0) instead of Profile Owner (User 10) on Android 10

---

## Problem Statement

BBTec MDM provisions as **Profile Owner (User 10)** on Android 10, while TestDPC achieves **Device Owner (User 0)** with identical QR provisioning. Device Owner status is **required** for kiosk mode and full device management.

**Current State:**
- ✅ TestDPC on Android 10: Device Owner (User 0) - Full control
- ❌ BBTec MDM on Android 10: Profile Owner (User 10) - Limited control
- Both tested identically: factory reset → QR code during OOBE

**Why This Matters:**
Device Owner capabilities needed for:
- Kiosk mode (Lock Task Mode) - full device lockdown
- System app management
- Network configuration control
- Factory reset protection
- Status bar disable
- Safe mode disable

---

## Root Cause Analysis

### Investigation Summary

**What We Tested:**
1. ✅ QR code format is correct (TestDPC works with our generated QR)
2. ✅ Provisioning flow works (APK downloads and installs)
3. ✅ Signature checksum format correct (base64url, no padding)
4. ✅ PROVISIONING_ADMIN_EXTRAS_BUNDLE present (server_url, enrollment_token)
5. ❌ Android 10 chooses Profile Owner for BBTec but Device Owner for TestDPC

### Key Findings from TestDPC Analysis

**TestDPC Manifest has but BBTec MDM doesn't:**

1. **PROVISIONING_SUCCESSFUL Activity** (CRITICAL)
   ```xml
   <activity
       android:name="com.afwsamples.testdpc.provision.ProvisioningSuccessActivity"
       android:exported="true">
       <intent-filter>
           <action android:name="android.app.action.PROVISIONING_SUCCESSFUL" />
           <category android:name="android.intent.category.DEFAULT" />
       </intent-filter>
   </activity>
   ```
   - Signals to Android that app supports full provisioning workflow
   - Android 10 uses this to determine Device Owner vs Profile Owner capability

2. **Additional Provisioning Activities:**
   - `GetProvisioningModeActivity` (Android 12+ - we already have this)
   - Both apps have same intent-filters on DeviceAdminReceiver
   - Both apps have identical device_admin.xml policies

**Hypothesis:** The `PROVISIONING_SUCCESSFUL` activity is the missing piece that tells Android 10 our app is capable of Device Owner mode.

---

## ✅ Phase 1: COMPLETED (2025-11-05 19:30 CET)

### What Was Achieved

**Goal:** Signal Device Owner capability to Android 10 by adding missing provisioning activity

**Changes Made:**

1. ✅ **Created ProvisioningSuccessActivity.kt**
   - File: `android-client/app/src/main/java/com/bbtec/mdm/client/ProvisioningSuccessActivity.kt`
   - Handles `ACTION_PROVISIONING_SUCCESSFUL` intent
   - Checks Device Owner status and logs confirmation
   - Launches MainActivity after successful provisioning
   - **This is the missing piece TestDPC had that we didn't**

2. ✅ **Updated AndroidManifest.xml**
   - Added PROVISIONING_SUCCESSFUL activity declaration
   - Exported with intent-filter for Android provisioning system
   - Signals to Android 10 that app supports Device Owner mode

3. ✅ **Version bumped to 0.0.9**
   - `versionCode = 9`, `versionName = "0.0.9"`
   - File: `android-client/app/build.gradle.kts`

4. ✅ **Built and signed APK**
   - Location: `artifacts/apks/bbtec-mdm-client-0.0.9.apk`
   - Size: 12 MB
   - Signed with development keystore (same as v0.0.8)
   - Signature verified successfully

**Build Output:**
```
BUILD SUCCESSFUL in 58s
44 actionable tasks: 44 executed
jar signed.
```

**Key Insight:**
The `PROVISIONING_SUCCESSFUL` activity is what Android uses to determine Device Owner capability. TestDPC has this activity, which is why it achieves Device Owner status on Android 10, while our v0.0.8 didn't have it and became Profile Owner instead.

---

## ❌ Phase 2: Test Results - FAILED (2025-11-06)

### Test Execution

**Date:** 2025-11-06
**APK Tested:** v0.0.9 (with ProvisioningSuccessActivity)
**Device:** Hannspree Zeus (Android 10)

**Steps Completed:**
1. ✅ Uploaded APK v0.0.9 to Convex via web portal
2. ✅ Generated fresh QR code with new APK
3. ✅ Factory reset device (Settings → System → Reset)
4. ✅ Provisioned via QR code during OOBE (6 taps → scan → WiFi → install)
5. ✅ Connected via ADB and checked device policy

### Result: STILL PROFILE OWNER ❌

**ADB Output:**
```bash
$ adb shell dumpsys device_policy

Profile Owner (User 10):
  admin=ComponentInfo{com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver}
  name=com.bbtec.mdm.client
  package=com.bbtec.mdm.client
  canAccessDeviceIds=true
```

**Conclusion:**
Adding the `ProvisioningSuccessActivity` alone was **NOT sufficient** to achieve Device Owner status on Android 10. The device still provisions as Profile Owner (User 10).

### Implications

1. **Hypothesis Rejected:** The PROVISIONING_SUCCESSFUL activity was necessary but not sufficient
2. **Need Deeper Investigation:** There must be other differences between TestDPC and BBTec MDM
3. **Proceed to Fallback Plan:** Compare device_admin.xml policies and QR code fields

---

## 🔍 Current Investigation: Fallback Approach 1 (2025-11-06)

**Status:** 🟡 In Progress
**Approach:** Compare device_admin.xml Policies

### Plan

TestDPC might declare additional policies in `device_admin.xml` that signal Device Owner capability to Android 10. We need to:

1. Extract `device_admin.xml` from TestDPC APK
2. Extract `device_admin.xml` from BBTec MDM v0.0.9 APK
3. Compare both files line-by-line
4. Identify any missing policies in BBTec MDM
5. Add missing policies and rebuild APK as v0.0.10

### Extraction Commands

```bash
# Create comparison directory
mkdir -p planning/device-admin-comparison

# Extract from TestDPC
aapt dump xmltree artifacts/apks/com.afwsamples.testdpc_9.0.12-9012_minAPI21\(nodpi\)_apkmirror.com.apk \
  res/xml/device_admin.xml > planning/device-admin-comparison/testdpc-device-admin.txt

# Extract from BBTec MDM v0.0.9
aapt dump xmltree artifacts/apks/bbtec-mdm-client-0.0.9.apk \
  res/xml/device_admin.xml > planning/device-admin-comparison/bbtec-device-admin.txt

# Compare
diff -u planning/device-admin-comparison/testdpc-device-admin.txt \
        planning/device-admin-comparison/bbtec-device-admin.txt
```

**Current Status:** Ready to execute after session restart

---

## 🧪 Phase 2: Testing Procedure (For Reference)

### Upload and Test Procedure

**Before Testing - Upload APK:**

1. Navigate to https://bbtec-mdm.vercel.app
2. Upload `artifacts/apks/bbtec-mdm-client-0.0.9.apk`
3. Note the Convex storage ID

**Testing Steps:**

1. **Generate Fresh QR Code** (2 minutes)
   - Use web portal QR generator
   - Select any policy (doesn't matter for this test)
   - Ensure enrollment token is fresh (not expired)
   - Save QR code image

2. **Factory Reset Device** (5 minutes)
   - Device: Hannspree Zeus (Android 10)
   - Settings → System → Reset → Factory data reset
   - Wait for reset to complete

3. **Provision Device** (5 minutes)
   - During OOBE welcome screen, tap 6 times
   - QR scanner activates
   - Scan the generated QR code
   - Connect to WiFi
   - Wait for APK to download and install
   - Watch for provisioning completion

4. **Verify Device Owner Status** (CRITICAL - 2 minutes)
   ```bash
   adb shell dumpsys device_policy
   ```

**Expected Output (SUCCESS):**
```
Device Owner (User 0): com.bbtec.mdm.client
Profile Owner (User 10): null
```

**Previous Output (v0.0.8 - FAILED):**
```
Device Owner (User 0): null
Profile Owner (User 10): com.bbtec.mdm.client
```

**Expected Logs (via adb logcat):**
```
ProvisioningSuccess: Provisioning successful! Processing completion...
ProvisioningSuccess: ✅ Device Owner mode confirmed!
MdmDeviceAdminReceiver: Provisioning complete - Device Owner mode activated!
MdmDeviceAdminReceiver: Is Device Owner: true
DeviceRegistration: DPC registration response: 200
DeviceRegistration: Registration successful! Token saved.
```

### Success Criteria

- ✅ APK downloads and installs successfully
- ✅ `dumpsys device_policy` shows **Device Owner (User 0)**
- ✅ Device registers with server (HTTP 200)
- ✅ Device appears in web portal
- ✅ ProvisioningSuccessActivity logs appear in logcat

### If Testing Succeeds

**Immediate benefits:**
- ✅ Device Owner mode achieved on Android 10
- ✅ Full device management capabilities unlocked
- ✅ Kiosk mode becomes testable

**Next steps:**
- Proceed to Phase 5: Test Basic Kiosk Mode
- Test with pre-installed app (Chrome/Calculator)
- Verify Lock Task Mode activation

### If Testing Fails (Still Profile Owner)

**Fallback investigation:**
1. Compare `device_admin.xml` policies with TestDPC
2. Check if additional QR fields needed (e.g., `PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED`)
3. Test on Android 13 Hannspree to verify if issue is Android 10 specific
4. Analyze TestDPC source code for hidden logic

---

## Implementation Plan (Original - For Reference)

### Phase 1: Add Missing Provisioning Activity ✅ COMPLETED

**Goal:** Signal Device Owner capability to Android 10

**Tasks:**

1. **Create ProvisioningSuccessActivity.kt**
   - Location: `android-client/app/src/main/java/com/bbtec/mdm/client/`
   - Handle `ACTION_PROVISIONING_SUCCESSFUL` intent
   - Launch MainActivity to show device management UI
   - Log provisioning completion with Device Owner status
   - Keep implementation simple - just acknowledge success and continue

2. **Add activity to AndroidManifest.xml**
   ```xml
   <activity
       android:name=".ProvisioningSuccessActivity"
       android:exported="true">
       <intent-filter>
           <action android:name="android.app.action.PROVISIONING_SUCCESSFUL" />
           <category android:name="android.intent.category.DEFAULT" />
       </intent-filter>
   </activity>
   ```

3. **Update version to 0.0.9**
   - File: `android-client/app/build.gradle.kts`
   - Change: `versionCode = 9`, `versionName = "0.0.9"`

4. **Build and sign APK**
   ```bash
   cd android-client
   ./gradlew clean assembleRelease

   jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
     -keystore bbtec-mdm.keystore -storepass android -keypass android \
     app/build/outputs/apk/release/app-release.apk bbtec-mdm

   # Verify signature
   jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk

   # Copy to artifacts
   cp app/build/outputs/apk/release/app-release.apk \
     ../artifacts/apks/bbtec-mdm-client-0.0.9.apk
   ```

**Estimated time:** 15-30 minutes

---

### Phase 2: Test on Android 10 🧪

**Goal:** Verify Device Owner status achieved

**Test Procedure:**

1. **Upload v0.0.9 to Convex**
   - Navigate to https://bbtec-mdm.vercel.app
   - Upload `artifacts/apks/bbtec-mdm-client-0.0.9.apk`
   - Note the new storage ID

2. **Generate Fresh QR Code**
   - Use web portal to generate QR with new APK
   - Ensure enrollment token is fresh (not expired)

3. **Factory Reset Device**
   - Device: Hannspree Zeus (Android 10)
   - Full factory reset via Settings

4. **Provision Device**
   - During OOBE, tap 6 times on welcome screen
   - Scan QR code
   - Connect to WiFi
   - Wait for APK download, install, and provisioning

5. **Verify Device Owner Status**
   ```bash
   adb shell dumpsys device_policy
   ```

**Success Criteria:**
```
✅ Expected output:
Device Owner (User 0): com.bbtec.mdm.client

❌ Current output (before fix):
Profile Owner (User 10): com.bbtec.mdm.client
```

**Estimated time:** 10 minutes

---

### Phase 3: Verify Full Functionality ✅

**Goal:** Ensure Device Owner doesn't break existing features

**Tests to Run:**

1. **Provisioning Flow**
   - ✅ APK downloads successfully
   - ✅ APK installs without errors
   - ✅ Device registers with server (HTTP 200)
   - ✅ Device appears in web portal
   - ✅ downloadCount increments

2. **Device Management**
   - ✅ Policy sync works (check logs)
   - ✅ Can issue lock command
   - ✅ Can issue reboot command
   - ✅ Device info displays correctly

3. **Logs to Check**
   ```bash
   adb logcat | grep -E "(MdmDeviceAdminReceiver|DeviceRegistration|ProvisioningSuccess)"
   ```

**Expected Logs:**
```
MdmDeviceAdminReceiver: Provisioning complete - Device Owner mode activated!
MdmDeviceAdminReceiver: Is Device Owner: true
DeviceRegistration: DPC registration response: 200
ProvisioningSuccessActivity: Provisioning successful!
```

**Estimated time:** 10 minutes

---

### Phase 4: Document Device Owner Benefits 📝

**Goal:** Understand newly available capabilities

**Newly Available Features:**

1. **Kiosk Mode (Lock Task Mode)**
   - Full device lockdown to specific apps
   - Disable status bar during kiosk
   - Prevent home button escape
   - Already implemented in PolicyManager.kt

2. **System Settings Control**
   - Configure WiFi networks
   - Enforce security policies
   - Control USB data transfer
   - Modify system settings

3. **App Management**
   - Silent app installation (already implemented)
   - Force app updates
   - Prevent app uninstall
   - Hide/show apps

4. **Security Features**
   - Factory reset protection
   - Safe mode disable
   - Camera disable (device-wide)
   - Screenshot blocking

**Estimated time:** 5 minutes (documentation update)

---

## Fallback Plan 🔄

If Phase 1 doesn't achieve Device Owner status:

### Alternative Approach 1: Compare device_admin.xml Policies
- TestDPC might declare additional policies
- Extract and compare both device_admin.xml files
- Add any missing policies to our implementation

### Alternative Approach 2: Check QR Code Fields
- Research if Android 10 requires specific QR fields for Device Owner
- Possible field: `PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED`
- Test with/without this field

### Alternative Approach 3: Test on Android 13
- Verify if issue is Android 10 specific
- Android 13 has ProvisioningModeActivity which should force Device Owner
- If Android 13 works, focus on Android 10 workarounds

### Alternative Approach 4: Analyze TestDPC Source Code
- TestDPC is open source: https://github.com/googlesamples/android-testdpc
- Review GetProvisioningModeActivity implementation
- Check for hidden logic that influences Android's decision

---

## Success Metrics 🎯

**Primary Goal:**
- ✅ BBTec MDM provisions as Device Owner (User 0) on Android 10

**Secondary Goals:**
- ✅ All existing functionality continues working
- ✅ No regressions in registration or policy sync
- ✅ Device appears correctly in web portal

**Tertiary Goal:**
- ✅ Kiosk mode becomes testable (Phase 5 - future)

---

## Timeline Estimate ⏱️

| Phase | Task | Time | Status |
|-------|------|------|--------|
| Phase 1 | Create ProvisioningSuccessActivity | 15-30 min | 🟡 Pending |
| Phase 1 | Update manifest & version | 5 min | 🟡 Pending |
| Phase 1 | Build and sign APK | 5 min | 🟡 Pending |
| Phase 2 | Upload and test on Android 10 | 10 min | 🟡 Pending |
| Phase 3 | Verify functionality | 10 min | 🟡 Pending |
| Phase 4 | Document results | 5 min | 🟡 Pending |
| **TOTAL** | | **~45 min** | |

---

## Next Steps After Device Owner Success 🚀

Once Device Owner is achieved, proceed to kiosk mode implementation:

### Phase 5: Test Basic Kiosk Mode
1. Create test policy with kiosk enabled
2. Test with pre-installed app (Chrome or Calculator)
3. Verify Lock Task Mode activation
4. Verify status bar disable works

### Phase 6: Remote APK Installation for Kiosk
1. Upload test APK via web portal
2. Queue installation command
3. Verify silent installation works as Device Owner
4. Add installed app to kiosk whitelist

### Phase 7: Full Kiosk Lockdown
1. Configure kiosk policy with all restrictions
2. Test device is truly "ruled" by single app
3. Test escape prevention (home button, notifications)
4. Document kiosk setup guide for users

---

## Evidence and References 📚

**TestDPC Manifest Analysis:**
- Command used: `/opt/android-sdk/build-tools/34.0.0/aapt dump xmltree [apk] AndroidManifest.xml`
- Found: `PROVISIONING_SUCCESSFUL` activity with exported=true
- Found: Same intent-filters on DeviceAdminReceiver as BBTec MDM

**Android Documentation:**
- Web search: "Android 10 QR code provisioning Device Owner vs Profile Owner"
- Key finding: QR code provisioning sets up Device Owner mode by default
- Key finding: Device owner can only be set from unprovisioned device

**Previous Test Results:**
- TestDPC on Android 10: Device Owner (User 0) ✅
- BBTec MDM v0.0.8 on Android 10: Profile Owner (User 10) ❌
- Both used identical QR provisioning method (factory reset → scan during OOBE)

**File Locations:**
- TestDPC APK: `artifacts/apks/com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk`
- BBTec MDM v0.0.8: `artifacts/apks/bbtec-mdm-client-0.0.8.apk`
- QR configs: `planning/qr-configs/`
- Session docs: `planning/SESSION-4-STATUS.md`

---

**Created:** 2025-11-05
**Last Updated:** 2025-11-06
**Status:** Phase 2 FAILED - Investigating device_admin.xml differences
