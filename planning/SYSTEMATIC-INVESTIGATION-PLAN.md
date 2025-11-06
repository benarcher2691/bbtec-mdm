# Systematic Investigation Plan - Device Owner Failure Root Cause

**Date:** 2025-11-06 14:00 CET
**Status:** 🔍 INVESTIGATION PLANNED
**Goal:** Find THE difference between TestDPC (works) and BBTec v0.0.14 (fails)

---

## Executive Summary

**The Situation:**
- **TestDPC on Android 10:** Shows choice screen → Device Owner (User 0) ✅
- **BBTec v0.0.14 on Android 10:** No choice screen → Profile Owner (User 10) ❌

**What We've Tried (All Failed):**
- ❌ v0.0.13: Changed targetSdk from 36 to 34
- ❌ v0.0.14: Added 22 MANAGE_DEVICE_POLICY permissions

**The Reality:**
Only **two variables** can differ during QR provisioning:
1. **QR code JSON content** - What Android reads from the QR
2. **APK file content** - Specifically metadata Android reads during provisioning decision

**TestDPC works, BBTec doesn't. The difference MUST be in one of these two places.**

---

## Phase 1: QR Code Deep Analysis

**Duration:** 30 minutes
**Goal:** Find if there's ANY QR parameter we're missing

### Tasks

#### 1.1 Character-by-Character QR Comparison
Compare the exact JSON structure:

**TestDPC Success QR:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.afwsamples.testdpc/com.afwsamples.testdpc.DeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.afwsamples.testdpc",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
}
```

**BBTec v0.0.14 QR:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2bb77529peq6xffmpzt93syx7txgar",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "d4aea496-f9e7-4f16-574b-6d176cf822c9"
  }
}
```

**Key Difference:**
- BBTec has `PROVISIONING_ADMIN_EXTRAS_BUNDLE`, TestDPC doesn't
- **BUT:** We already tested v0.0.12-test WITHOUT extras bundle → still failed

#### 1.2 Research Android 10 QR Provisioning Parameters
Check AOSP Android 10 source code:
- `frameworks/base/core/java/android/app/admin/DevicePolicyManager.java` (API 29)
- Look for ALL `EXTRA_PROVISIONING_*` constants
- Find which ones affect Device Owner vs Profile Owner decision

#### 1.3 Test Hidden Parameters
Investigate these potential parameters:
- `EXTRA_PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED`
- `EXTRA_PROVISIONING_DISCLAIMERS`
- `EXTRA_PROVISIONING_LOCALE`
- `EXTRA_PROVISIONING_TIME_ZONE`
- `EXTRA_PROVISIONING_LOCAL_TIME`
- Any others found in AOSP source

### Deliverable
**Result:** Definitive list of QR differences OR confirmation QRs are functionally identical for provisioning mode selection

---

## Phase 2: AndroidManifest.xml Line-by-Line Comparison

**Duration:** 45 minutes
**Goal:** Find the ONE manifest attribute that makes Android show/hide the choice screen

### Tasks

#### 2.1 Extract Manifests as Human-Readable XML
```bash
# Install apktool if needed
# Extract both APKs
apktool d /home/ben/sandbox/bbtec-mdm/com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk -o /tmp/testdpc-extracted
apktool d /home/ben/sandbox/bbtec-mdm/artifacts/apks/bbtec-mdm-client-0.0.14.apk -o /tmp/bbtec-extracted

# Compare manifests
diff /tmp/testdpc-extracted/AndroidManifest.xml /tmp/bbtec-extracted/AndroidManifest.xml
```

#### 2.2 Compare Application-Level Attributes
Check these flags in `<application>` tag:

| Attribute | TestDPC | BBTec | Impact |
|-----------|---------|-------|--------|
| `android:debuggable` | ? | ? | Debug builds may be excluded from Device Owner |
| `android:testOnly` | ? | ? | Test-only apps cannot be Device Owner |
| `android:allowBackup` | ? | ? | Backup policy |
| `android:persistent` | ? | ? | System persistence |
| `android:icon` | ? | ? | Icon resource |
| `android:label` | ? | ? | App label |
| `android:theme` | ? | ? | UI theme |
| `android:name` | ? | ? | Application class |

#### 2.3 Compare Receiver Declarations
Focus on `DeviceAdminReceiver`:

**Points to check:**
- Intent filter order (does order matter?)
- `android:exported` value
- `android:priority` if present
- `android:permission` declaration
- Meta-data structure
- Description vs label

**TestDPC Receiver:**
```xml
<receiver
    android:label="@string/app_name"
    android:name="com.afwsamples.testdpc.DeviceAdminReceiver"
    android:permission="android.permission.BIND_DEVICE_ADMIN"
    android:exported="true"
    android:description="@string/app_name">
  <meta-data
      android:name="android.app.device_admin"
      android:resource="@xml/device_admin"/>
  <intent-filter>
    <action android:name="android.app.action.DEVICE_ADMIN_ENABLED"/>
    <action android:name="android.app.action.PROFILE_PROVISIONING_COMPLETE"/>
    <action android:name="android.intent.action.BOOT_COMPLETED"/>
    <action android:name="android.app.action.PROFILE_OWNER_CHANGED"/>
    <action android:name="android.app.action.DEVICE_OWNER_CHANGED"/>
  </intent-filter>
</receiver>
```

**BBTec Receiver:**
```xml
<receiver
    android:name=".MdmDeviceAdminReceiver"
    android:permission="android.permission.BIND_DEVICE_ADMIN"
    android:exported="true"
    android:description="@string/app_name"
    android:label="@string/app_name">
  <meta-data
      android:name="android.app.device_admin"
      android:resource="@xml/device_admin"/>
  <intent-filter>
    <action android:name="android.app.action.DEVICE_ADMIN_ENABLED"/>
    <action android:name="android.app.action.PROFILE_PROVISIONING_COMPLETE"/>
    <action android:name="android.intent.action.BOOT_COMPLETED"/>
    <action android:name="android.app.action.PROFILE_OWNER_CHANGED"/>
    <action android:name="android.app.action.DEVICE_OWNER_CHANGED"/>
  </intent-filter>
</receiver>
```

**Differences to investigate:**
- TestDPC: `label` before `name`, BBTec: `name` before `label` (order matters?)
- Any resource ID differences?

#### 2.4 Compare Activity Declarations

**Focus on:**
- `ProvisioningSuccessActivity` (handles `ACTION_PROVISIONING_SUCCESSFUL`)
- Any activity with provisioning-related intent filters
- GetProvisioningModeActivity (Android 12+, but might be checked even on Android 10?)

#### 2.5 Compare All Intent Filters
Extract all intent filters and compare:
```bash
grep -A10 "intent-filter" /tmp/testdpc-extracted/AndroidManifest.xml > /tmp/testdpc-intents.txt
grep -A10 "intent-filter" /tmp/bbtec-extracted/AndroidManifest.xml > /tmp/bbtec-intents.txt
diff /tmp/testdpc-intents.txt /tmp/bbtec-intents.txt
```

### Deliverable
**Result:** Exact list of ALL manifest differences with analysis of which could affect provisioning

---

## Phase 3: device_admin.xml Byte-Level Verification

**Duration:** 15 minutes
**Goal:** Confirm device_admin.xml is truly identical (not just functionally similar)

### Tasks

#### 3.1 Extract device_admin.xml from Both APKs
```bash
# Using apktool extracts from Phase 2
cat /tmp/testdpc-extracted/res/xml/device_admin.xml > /tmp/testdpc-device-admin.xml
cat /tmp/bbtec-extracted/res/xml/device_admin.xml > /tmp/bbtec-device-admin.xml
```

#### 3.2 Compare XML Structure
```bash
diff /tmp/testdpc-device-admin.xml /tmp/bbtec-device-admin.xml
```

#### 3.3 Compare Binary Resource Files
```bash
# Compare the compiled XML from original APKs
unzip -p testdpc.apk res/xml/*.xml | xxd > /tmp/testdpc-device-admin-binary.txt
unzip -p bbtec-0.0.14.apk res/xml/*.xml | xxd > /tmp/bbtec-device-admin-binary.txt
diff /tmp/testdpc-device-admin-binary.txt /tmp/bbtec-device-admin-binary.txt
```

### Deliverable
**Result:** Confirmation they're byte-identical OR exact difference with analysis

---

## Phase 4: APK Build Metadata Deep Dive

**Duration:** 30 minutes
**Goal:** Check if build configuration affects Android's provisioning decision

### Tasks

#### 4.1 Compare APK Signing Details
```bash
# Get full certificate details
unzip -p testdpc.apk META-INF/*.RSA | keytool -printcert > /tmp/testdpc-cert.txt
unzip -p bbtec-0.0.14.apk META-INF/*.RSA | keytool -printcert > /tmp/bbtec-cert.txt
diff /tmp/testdpc-cert.txt /tmp/bbtec-cert.txt
```

**Check:**
- Certificate CN (Common Name)
- Certificate OU (Organizational Unit)
- Validity period
- Key size
- Signature algorithm

#### 4.2 Compare platformBuildVersion
```bash
aapt dump badging testdpc.apk | grep platform > /tmp/testdpc-platform.txt
aapt dump badging bbtec-0.0.14.apk | grep platform > /tmp/bbtec-platform.txt
diff /tmp/testdpc-platform.txt /tmp/bbtec-platform.txt
```

#### 4.3 Check for Debug/Test Markers
```bash
# Check if APK is marked as debuggable
aapt dump badging testdpc.apk | grep -i debug
aapt dump badging bbtec-0.0.14.apk | grep -i debug

# Check for testOnly flag
aapt dump badging testdpc.apk | grep -i test
aapt dump badging bbtec-0.0.14.apk | grep -i test
```

#### 4.4 Compare All APK Metadata
```bash
aapt dump badging testdpc.apk > /tmp/testdpc-full-badging.txt
aapt dump badging bbtec-0.0.14.apk > /tmp/bbtec-full-badging.txt
diff /tmp/testdpc-full-badging.txt /tmp/bbtec-full-badging.txt
```

#### 4.5 Compare Build Properties
Check `META-INF/` contents:
```bash
unzip -l testdpc.apk | grep META-INF
unzip -l bbtec-0.0.14.apk | grep META-INF
```

Look for:
- `MANIFEST.MF` differences
- Any `.properties` files
- Build timestamp differences

### Deliverable
**Result:** All metadata differences with assessment of impact

---

## Phase 5: Resource and String Analysis (If Still Not Found)

**Duration:** 30 minutes
**Fallback if Phases 1-4 don't reveal the issue**

### Tasks

#### 5.1 Compare String Resources
Android might check for specific strings:
```bash
grep -r "device.owner\|fully.managed\|work.profile" /tmp/testdpc-extracted/res/values/
grep -r "device.owner\|fully.managed\|work.profile" /tmp/bbtec-extracted/res/values/
```

#### 5.2 Compare All XML Resources
```bash
diff -r /tmp/testdpc-extracted/res/ /tmp/bbtec-extracted/res/
```

#### 5.3 Check for Hidden Assets
```bash
unzip -l testdpc.apk | grep assets
unzip -l bbtec-0.0.14.apk | grep assets
```

### Deliverable
**Result:** Any resource-level differences

---

## Expected Outcome

**One of these phases WILL find the difference because:**

1. **TestDPC works on Android 10** → There is a working configuration
2. **BBTec doesn't work on Android 10** → There is a failing configuration
3. **Both are APKs processed by the same Android system** → The difference is in the data
4. **We're comparing everything Android can read** → We will find it

**When we find the difference:**
1. Document it clearly
2. Apply the fix to create v0.0.15
3. Test on Android 10
4. Verify Device Owner mode achieved

---

## Investigation Log

### Phase 1 Results
**Status:** NOT STARTED
**Findings:**

### Phase 2 Results
**Status:** NOT STARTED
**Findings:**

### Phase 3 Results
**Status:** NOT STARTED
**Findings:**

### Phase 4 Results
**Status:** NOT STARTED
**Findings:**

### Phase 5 Results
**Status:** NOT STARTED
**Findings:**

---

## Success Criteria

Investigation is complete when:
- ✅ We find THE difference between TestDPC and BBTec
- ✅ The difference logically explains why choice screen appears/doesn't appear
- ✅ We can reproduce the fix
- ✅ v0.0.15 shows choice screen and achieves Device Owner mode

---

**Status:** Ready to begin systematic investigation
