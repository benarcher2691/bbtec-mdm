# QR Code Configurations - Reference Archive

This directory contains example QR code configurations used during testing and debugging.

**Purpose:** Version control working and broken QR configurations so we can:
1. Reproduce test scenarios
2. Compare working vs broken formats
3. Document the evolution of QR code requirements

---

## ✅ Working Configurations

### testdpc-success.json

**Status:** ✅ WORKING - Provisioned successfully on Android 10
**Date:** 2025-11-05
**Test Result:** TestDPC v9.0.12 provisioned as Device Owner (User 0)

**What it contains:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.afwsamples.testdpc/com.afwsamples.testdpc.DeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.afwsamples.testdpc",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
}
```

**Key characteristics:**
- Full qualified component name: `com.afwsamples.testdpc/com.afwsamples.testdpc.DeviceAdminReceiver`
- Redirect URL (not direct Convex URL): `https://bbtec-mdm.vercel.app/api/apps/[storageId]`
- URL-safe base64 signature (no padding)
- **Does NOT include `PROVISIONING_ADMIN_EXTRAS_BUNDLE`** (TestDPC doesn't need enrollment token)

**Why it worked:**
- TestDPC is a standalone DPC that doesn't require server enrollment
- All required Android provisioning fields present
- Signature checksum matches actual APK signature
- Download URL accessible and returns valid APK

**Device tested:**
- Hannspree Zeus, Android 10
- Provisioned as Device Owner (User 0)

**Evidence:**
```
dumpsys device_policy:
Device Owner (User 0): com.afwsamples.testdpc
Profile Owner (User 10): null
```

---

## ❌ Broken Configurations (For Reference)

### bbtec-broken-missing-extras.json

**Status:** ❌ BROKEN - Registration failed with HTTP 400
**Date:** 2025-11-05
**Test Result:** APK installed but registration failed

**What it contains:**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2c0n5m61jc01hx00crgs3pmd7tr64z",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
}
```

**What's missing:**
```json
{
  ...
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "tok_..."
  }
}
```

**Why it failed:**
- APK provisioned successfully as Profile Owner (User 10)
- `MdmDeviceAdminReceiver.onProfileProvisioningComplete()` expects admin extras bundle
- Without `server_url` and `enrollment_token`, app cannot register with MDM server
- Registration request failed: "Missing required device information or enrollment token"

**Error from logs:**
```
11-05 12:30:13.657 D/DeviceRegistration: DPC registration response: 400
11-05 12:30:13.658 E/DeviceRegistration: DPC registration failed: {"error":"Missing required device information or enrollment token"}
```

**Root cause:**
This QR was manually created for testing APK download, not generated through the web portal which automatically includes `PROVISIONING_ADMIN_EXTRAS_BUNDLE`.

**Code reference:**
- `android-client/.../MdmDeviceAdminReceiver.kt:29-36` - Expects to extract admin extras
- `src/app/actions/enrollment.ts:89-92` - Web portal correctly includes this field

---

## 📋 Correct Format for Custom MDM DPC

For custom MDM systems like BBTec MDM that require server enrollment, the QR code **MUST** include:

```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/[storageId]",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "tok_..."
  }
}
```

**How to generate:**
1. Navigate to MDM web portal (https://bbtec-mdm.vercel.app)
2. Select a policy
3. Click "Generate QR Code"
4. The system automatically includes all required fields including admin extras bundle

**Implementation:** `src/app/actions/enrollment.ts:83-93`

---

## 🔍 Key Differences

| Field | TestDPC | BBTec MDM (Broken) | BBTec MDM (Correct) |
|-------|---------|-------------------|---------------------|
| Component Name | ✅ | ✅ | ✅ |
| Package Name | ✅ | ✅ | ✅ |
| Download Location | ✅ | ✅ | ✅ |
| Signature Checksum | ✅ | ✅ | ✅ |
| Skip Encryption | ✅ | ✅ | ✅ |
| Admin Extras Bundle | ❌ Not needed | ❌ Missing | ✅ Required |
| → server_url | N/A | ❌ Missing | ✅ Required |
| → enrollment_token | N/A | ❌ Missing | ✅ Required |

---

## 📚 Related Documentation

- **Root cause analysis:** `planning/REGISTRATION-FAILURE-ROOT-CAUSE.md`
- **Session status:** `planning/SESSION-4-STATUS.md`
- **Baseline test instructions:** `planning/TESTDPC-BASELINE-TEST.md`
- **Android provisioning reference:** `docs/android-qr-provisioning.md`

---

## ⚠️ Important Notes

1. **Never manually create QR codes for production** - Always use the web portal
2. **Enrollment tokens expire** - Typically 1 hour by default
3. **Tokens are single-use** - Each QR code should have a unique token
4. **Storage IDs change** - When uploading new APK versions, update QR configs
5. **Signature checksums are APK-specific** - Different builds = different checksums

---

**Last Updated:** 2025-11-05
