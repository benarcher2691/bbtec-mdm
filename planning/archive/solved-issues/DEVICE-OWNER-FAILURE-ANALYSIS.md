# Device Owner Failure Analysis - Complete Documentation

**Date:** 2025-11-06
**Device:** Hannspree Zeus, Android 10 (API 29)
**Goal:** Achieve Device Owner (User 0) mode instead of Profile Owner (User 10)
**Status:** ALL HYPOTHESES REJECTED ❌

---

## Executive Summary

After 4 distinct APK versions and comprehensive QR code analysis, **BBTec MDM consistently becomes Profile Owner (User 10) on Android 10**, while TestDPC achieves Device Owner (User 0) with the same workflow on the same device.

All major differences between TestDPC and BBTec MDM have been eliminated:
- ✅ device_admin.xml matches TestDPC
- ✅ Provisioning callbacks match TestDPC
- ✅ AndroidManifest.xml is functionally identical
- ✅ QR code structure matches TestDPC (with/without admin extras)

**Android 10 STILL selects Profile Owner mode for BBTec MDM.**

---

## Test Timeline & Results

### v0.0.9 (Baseline)
**Date:** Before 2025-11-06
**Changes:** Base implementation with all provisioning features
**Result:** Profile Owner (User 10) ❌

### v0.0.10 (device_admin.xml alignment)
**Date:** 2025-11-06 ~10:00
**Hypothesis:** Missing device_admin.xml policies cause Profile Owner selection
**Changes:**
- Added `<headless-system-user>` with attributes from TestDPC
- Added `<support-transfer-ownership/>`
- Added `<watch-login/>` policy

**QR Code:** Standard with PROVISIONING_ADMIN_EXTRAS_BUNDLE
**Result:** Profile Owner (User 10) ❌
**Conclusion:** device_admin.xml policies do NOT determine Device Owner vs Profile Owner

---

### v0.0.11 (Provisioning callback alignment)
**Date:** 2025-11-06 ~10:30
**Hypothesis:** Provisioning callback timing/handling causes mode selection
**Changes:**
- Skip `onProfileProvisioningComplete()` on Android 8.0+ (matches TestDPC)
- Move all provisioning logic to `ProvisioningSuccessActivity`
- Handle `ACTION_PROVISIONING_SUCCESSFUL` as primary callback

**QR Code:** Standard with PROVISIONING_ADMIN_EXTRAS_BUNDLE
**Result:** Profile Owner (User 10) ❌
**Conclusion:** Provisioning callback handling does NOT determine mode selection

---

### v0.0.12-test (No admin extras bundle)
**Date:** 2025-11-06 11:00-12:00
**Hypothesis:** `PROVISIONING_ADMIN_EXTRAS_BUNDLE` in QR code signals Profile Owner mode
**Evidence:** TestDPC's successful QR code has NO admin extras bundle
**Changes:**
- Added test mode to QR generation (omits PROVISIONING_ADMIN_EXTRAS_BUNDLE)
- Modified ProvisioningSuccessActivity to handle missing admin extras gracefully
- Web UI checkbox for explicit test mode control

**QR Code:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg212ze7rmxajq0zkpf1n617bs7tx1zw",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
}
```

**Result:** Profile Owner (User 10) ❌
**Conclusion:** PROVISIONING_ADMIN_EXTRAS_BUNDLE does NOT determine mode selection

---

## Verified Facts

### ✅ Workflow is Correct
User confirmed exact workflow (performed hundreds of times):
1. Factory reset device
2. On welcome screen → tap 6 times
3. Scan QR code
4. Connect to WiFi
5. Wait for provisioning

This is the **correct OOBE (Out-of-Box Experience) workflow** for Device Owner.

### ✅ Device State is Clean
```bash
adb shell pm list users
# Output:
Users:
    UserInfo{0:Owner:13} running
    UserInfo{10:Work profile:70} running
```

After factory reset, User 0 exists (as expected), but Android still creates Work Profile (User 10) instead of Device Owner.

### ✅ APK is Correctly Signed
```bash
jarsigner -verify -verbose -certs app-release.apk
# jar verified.
```

Signature checksum: `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE` (SHA-256 base64url)

### ✅ QR Code is Correct
Server logs prove QR generation is correct. Third-party QR decoder confirms the displayed QR contains full download URL (not empty).

### ✅ TestDPC Achieves Device Owner on Same Device
With same workflow, TestDPC becomes Device Owner (User 0). This proves:
- Device hardware supports Device Owner
- Android 10 version supports Device Owner
- QR provisioning workflow is correct

---

## What We've Eliminated

### 1. device_admin.xml Differences
**Status:** ELIMINATED in v0.0.10

Compared extracted device_admin.xml from both APKs:
- TestDPC has `<headless-system-user>`, `<support-transfer-ownership/>`, `<watch-login/>`
- Added all three to BBTec MDM v0.0.10
- Verified presence in installed APK using aapt
- **No effect on mode selection**

### 2. AndroidManifest.xml Differences
**Status:** ELIMINATED via analysis

Comprehensive manifest comparison shows:
- Both have `<receiver>` for DeviceAdminReceiver with `BIND_DEVICE_ADMIN` permission
- Both have `<activity>` for ProvisioningSuccessActivity
- Both handle `ACTION_PROVISIONING_SUCCESSFUL` intent
- Both declare required permissions

**No critical differences found.**

### 3. Provisioning Callback Handling
**Status:** ELIMINATED in v0.0.11

TestDPC pattern:
- Skip `onProfileProvisioningComplete()` on Android 8.0+
- Do all work in ProvisioningSuccessActivity

Applied same pattern to BBTec MDM.
- **No effect on mode selection**

### 4. QR Code PROVISIONING_ADMIN_EXTRAS_BUNDLE
**Status:** ELIMINATED in v0.0.12-test

TestDPC's QR has no admin extras bundle.
Created test QR without admin extras bundle.
- **No effect on mode selection**

---

## Current Device Policy Status

```
Current Device Policy Manager state:
  Profile Owner (User 10):
    admin=ComponentInfo{com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver}
    name=com.bbtec.mdm.client
    package=com.bbtec.mdm.client
    canAccessDeviceIds=true

  Enabled Device Admins (User 0, provisioningState: 0):
    <empty>

  Enabled Device Admins (User 10, provisioningState: 3):
    com.bbtec.mdm.client/.MdmDeviceAdminReceiver:
      uid=1010140
      policies: [all policies listed]
```

**Key observations:**
- User 0 has NO device admins (should have Device Owner here)
- User 10 has BBTec MDM as Profile Owner
- `provisioningState: 3` = provisioned
- `canAccessDeviceIds=true` (Profile Owner privilege)

---

## Remaining Unknowns

### 1. Android's Mode Selection Logic
**When does Android decide Device Owner vs Profile Owner?**

According to AOSP documentation:
- During QR provisioning, Android checks:
  - Is device in OOBE (Out-of-Box Experience)?
  - Are there existing user accounts?
  - Is setup wizard completed?
  - **What else?**

### 2. APK-Level Differences
**Potential areas not yet investigated:**

#### a) Package Name Pattern
- TestDPC: `com.afwsamples.testdpc`
- BBTec: `com.bbtec.mdm.client`

Could package naming affect mode selection? (Unlikely, but unverified)

#### b) Build Fingerprint / Debuggable Flag
```kotlin
// Our build.gradle.kts
buildTypes {
    release {
        isMinifyEnabled = false
        proguardFiles(...)
        signingConfig = signingConfigs.getByName("release")
    }
}
```

Is TestDPC built differently?

#### c) Permissions Order/Timing
Do permissions need to be requested in specific order?

#### d) Embedded Resources
Does TestDPC have special resources or assets that signal Device Owner intent?

### 3. Runtime Behavior During Provisioning
**What happens between APK installation and admin activation?**

We see our app code AFTER Android has already decided Profile Owner.
What happens BEFORE our code runs that determines the mode?

### 4. Convex/Server-Side Timing
Is there any server-side interaction during provisioning that could affect mode selection?
(Unlikely - provisioning is client-side, but worth investigating)

---

## Testing Artifacts

### APKs
- `artifacts/apks/bbtec-mdm-client-0.0.9.apk` - Baseline (not in repo)
- `artifacts/apks/bbtec-mdm-client-0.0.10.apk` - device_admin.xml changes
- `artifacts/apks/bbtec-mdm-client-0.0.11.apk` - Callback changes
- `artifacts/apks/bbtec-mdm-client-0.0.12-test.apk` - No admin extras handling

### QR Configs
- `planning/qr-configs/testdpc-success.json` - TestDPC QR that achieved Device Owner
- `planning/qr-configs/test-no-admin-extras-TEMPLATE.json` - Template for v0.0.12-test

### Comparison Data
- `planning/device-admin-comparison/ANALYSIS.md` - device_admin.xml comparison
- `planning/manifest-comparison/MANIFEST-ANALYSIS.md` - AndroidManifest.xml comparison
- `planning/testdpc-DeviceAdminReceiver.java` - TestDPC source code reference

### Logs
- `logs_result-2025-11-06-11-40.csv` - Vercel logs showing correct QR generation
- `logs_result-2025-11-06-12-12.csv` - Latest test logs

---

## Next Investigation Steps

### Phase 1: Deep APK Analysis
1. **Extract and compare TestDPC vs BBTec MDM:**
   - All resources (res/ directory)
   - All assets
   - META-INF signatures in detail
   - Compiled code structure
   - Build configuration artifacts

2. **Check for hidden differences:**
   - Permissions timing/order
   - Intent filter priorities
   - Service declarations
   - Broadcast receiver order

### Phase 2: Runtime Investigation
1. **Instrument provisioning flow:**
   - Add extensive logging before/after every Android callback
   - Log device state at each step
   - Check for any unexpected API calls

2. **Monitor Android system logs during provisioning:**
   ```bash
   adb logcat -v time -s DevicePolicyManager PackageManager ActivityManager
   ```

### Phase 3: Android Source Code Review
1. **Review AOSP DevicePolicyManager source:**
   - How does `setDeviceOwner()` vs `setProfileOwner()` get called?
   - What conditions trigger each mode?
   - Android 10 specific changes

2. **Check for version-specific quirks:**
   - Android 10 (API 29) specific provisioning behavior
   - Device manufacturer customizations (Hannspree)

### Phase 4: Alternative Approaches
1. **ADB-based Device Owner setup:**
   ```bash
   adb shell dpm set-device-owner com.bbtec.mdm.client/.MdmDeviceAdminReceiver
   ```
   Does this work? If yes, problem is QR provisioning specific.

2. **NFC provisioning:**
   Does NFC provisioning achieve Device Owner?

3. **Different Android versions:**
   Test on Android 11, 12, 13 to isolate Android 10 specific issues

---

## Critical Questions

1. **Why does TestDPC succeed where BBTec fails?**
   - Same device, same workflow, same QR structure
   - What is THE differentiator?

2. **Is this an Android 10 specific issue?**
   - Would Android 11+ behave differently?
   - Is there a known Android 10 bug/quirk?

3. **Is Device Owner even possible for custom DPCs on Android 10?**
   - TestDPC is Google's official sample
   - Do custom DPCs face restrictions?

4. **Is there a Google Play Services dependency?**
   - Does Device Owner mode require Play Services?
   - TestDPC might have special allowlisting

---

## Resources

### Android Documentation
- [Provisioning Methods](https://developer.android.com/work/dpc/provisioning)
- [QR Code Provisioning](https://developer.android.com/work/dpc/qr-code)
- [Device Owner vs Profile Owner](https://developer.android.com/work/dpc/dedicated-devices/device-owner)

### TestDPC Source
- [GitHub: android-testdpc](https://github.com/googlesamples/android-testdpc)
- Commit used for comparison: Latest as of 2025-11-06

### AOSP Source
- [DevicePolicyManager.java](https://cs.android.com/android/platform/superproject/+/android-10.0.0_r47:frameworks/base/core/java/android/app/admin/DevicePolicyManager.java)

---

**Conclusion:** We have systematically eliminated all visible differences between TestDPC and BBTec MDM. The root cause of Profile Owner selection on Android 10 remains unknown and requires deeper investigation into Android's internal provisioning logic.

**Status:** INVESTIGATION ONGOING
