# TEST: v0.0.12 - Device Owner Without PROVISIONING_ADMIN_EXTRAS_BUNDLE

**Date:** 2025-11-06 11:06 CET
**Hypothesis:** The `PROVISIONING_ADMIN_EXTRAS_BUNDLE` in the QR code causes Android 10 to choose Profile Owner mode instead of Device Owner

---

## Hypothesis

**TestDPC's successful QR code that achieved Device Owner:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "...",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
}
```
**NO `PROVISIONING_ADMIN_EXTRAS_BUNDLE`** ✅

**Our QR codes (v0.0.8-0.0.11) that became Profile Owner:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "...",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "tok_..."
  }
}
```
**HAS `PROVISIONING_ADMIN_EXTRAS_BUNDLE`** ❌

**Theory:** Android 10 sees the admin extras bundle and assumes this is a Profile Owner (work profile) setup because admin extras are typically used for work profiles, not Device Owner mode.

---

## What's Changed in v0.0.12-test

### APK Changes

**ProvisioningSuccessActivity.kt:**
- Now handles **missing** `PROVISIONING_ADMIN_EXTRAS_BUNDLE` gracefully
- Uses hardcoded server URL: `https://bbtec-mdm.vercel.app`
- Skips device registration (no enrollment token available)
- Still starts polling service and checks Device Owner status
- Logs: `⚠️ TEST MODE: No EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE in intent!`

**MdmDeviceAdminReceiver.kt:**
- Legacy path updated for consistency
- Same test mode handling

**Result:** App will install and run WITHOUT crashing when QR has no admin extras bundle

### Build Info

- **APK:** `artifacts/apks/bbtec-mdm-client-0.0.12-test.apk`
- **Version:** 0.0.12-test (versionCode 12)
- **Size:** 12 MB
- **Signed:** ✅

---

## TEST PROCEDURE

### Step 1: Create Test QR Code (MANUAL)

**CRITICAL:** You need to create a QR code JSON **WITHOUT** the `PROVISIONING_ADMIN_EXTRAS_BUNDLE` field.

**Create file:** `planning/qr-configs/test-no-admin-extras.json`

```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/STORAGE_ID_HERE",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "CHECKSUM_HERE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
}
```

**You need to fill in:**
1. `STORAGE_ID_HERE` - The Convex storage ID after uploading v0.0.12-test APK
2. `CHECKSUM_HERE` - The signature checksum for v0.0.12-test APK

**To get the checksum for v0.0.12-test:**
```bash
cd android-client
unzip -p app/build/outputs/apk/release/app-release.apk META-INF/*.RSA | keytool -printcert | grep "SHA256:" | awk '{print $2}' | xxd -r -p | base64 | tr '/+' '_-' | tr -d '='
```

### Step 2: Upload v0.0.12-test APK

1. Navigate to https://bbtec-mdm.vercel.app
2. Upload `artifacts/apks/bbtec-mdm-client-0.0.12-test.apk`
3. Note the Convex storage ID
4. Update the QR JSON with the storage ID

### Step 3: Generate QR Code

Use your QR generator (or online tool) to generate a QR code from the JSON WITHOUT admin extras bundle.

**File:** `planning/qr-configs/test-no-admin-extras.json`

### Step 4: Factory Reset and Provision

**Workflow (same as always):**
1. Factory reset device (Hannspree Zeus, Android 10)
2. On Welcome screen → Tap 6 times
3. Scan the new QR code (WITHOUT admin extras)
4. Connect to WiFi
5. Wait for APK download and installation
6. Watch for provisioning completion

### Step 5: Check Device Owner Status

```bash
adb shell dumpsys device_policy
```

**Expected (if hypothesis is correct):**
```
Device Owner (User 0): com.bbtec.mdm.client  ✅✅✅
Profile Owner (User 10): null
```

**If still Profile Owner:**
```
Device Owner (User 0): null
Profile Owner (User 10): com.bbtec.mdm.client  ❌
```

### Step 6: Check Logs

```bash
adb logcat -d | grep -E "(ProvisioningSuccess|MdmDeviceAdminReceiver)"
```

**Expected logs:**
```
MdmDeviceAdminReceiver: Android 29 - skipping onProfileProvisioningComplete
ProvisioningSuccess: Provisioning successful! Android 29
ProvisioningSuccess: ⚠️ TEST MODE: No EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE in intent!
ProvisioningSuccess: ⚠️ Using hardcoded values for testing Device Owner status
ProvisioningSuccess: ⚠️ Skipping device registration (test mode)
ProvisioningSuccess: ✅ Test provisioning complete - CHECK DEVICE OWNER STATUS
```

---

## Interpretation of Results

### If Device Owner ✅

**HYPOTHESIS CONFIRMED!**
- The `PROVISIONING_ADMIN_EXTRAS_BUNDLE` was preventing Device Owner mode
- Android 10 interprets admin extras as a signal for Profile Owner (work profile)
- **Solution:** Pass enrollment token via a different mechanism (e.g., server-side matching by device ID)

### If Still Profile Owner ❌

**Hypothesis rejected - Keep investigating:**
1. Check if there's another QR field difference
2. Verify device state (accounts, user 0 status)
3. Test with even more minimal QR (only required fields)
4. Consider Android 10 specific provisioning quirks

---

## Limitations of Test Build

**v0.0.12-test will NOT:**
- Register with the server (no enrollment token)
- Appear in the web portal device list
- Sync policies correctly
- Function as a real MDM client

**Purpose of v0.0.12-test:**
- Test ONLY Device Owner vs Profile Owner status
- Determine if admin extras bundle is the blocker
- Guide next steps for proper implementation

---

## Next Steps After Test

### If Device Owner Achieved ✅

**Option A: Server-side device matching**
- Device generates unique ID (Android ID, serial number)
- Server creates "pending device" record
- Device registers using its unique ID
- Server matches and assigns enrollment token

**Option B: Post-provisioning token delivery**
- Provision without token (Device Owner achieved)
- Show QR code or PIN in app
- Admin scans/enters on web portal
- Token delivered via server push

**Option C: Different QR parameter**
- Research alternative QR fields for passing data
- Use a standard field Android expects but doesn't use

### If Still Profile Owner ❌

Continue investigation with fallback approaches.

---

**Created:** 2025-11-06 11:06 CET
**Status:** Ready for testing
**Confidence:** MEDIUM (60%) - TestDPC evidence supports hypothesis, but not 100% certain
