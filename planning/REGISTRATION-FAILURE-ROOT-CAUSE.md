# Registration Failure - Root Cause Analysis

**Date:** 2025-11-05
**Status:** RESOLVED - Root cause identified
**Device:** Android 10 (User 10 / Profile Owner mode)

## Executive Summary

The device registration failed with HTTP 400 error "Missing required device information or enrollment token" because the QR code used for provisioning (**bbtec-mdm-qr-FINAL.json**) was **missing the `PROVISIONING_ADMIN_EXTRAS_BUNDLE` field** that contains the server URL and enrollment token.

Without these values, the app had no enrollment token to send in the registration request, causing the server validation to reject it.

---

## The Complete Flow

### 1. QR Code Provisioning (What Should Happen)

**Expected QR Code Format (from enrollment.ts:83-93):**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "...",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "...",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "tok_abc123..."
  }
}
```

**Actual QR Code Used (bbtec-mdm-qr-FINAL.json):**
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2c0n5m61jc01hx00crgs3pmd7tr64z",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
}
```

**❌ Missing:** `PROVISIONING_ADMIN_EXTRAS_BUNDLE` with `server_url` and `enrollment_token`

---

### 2. Android Provisioning Process

After QR scan and APK download, Android should call `MdmDeviceAdminReceiver.onProfileProvisioningComplete()`:

**MdmDeviceAdminReceiver.kt:29-36**
```kotlin
val adminExtras = intent.getBundleExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE)

val serverUrl = adminExtras?.getString("server_url")
val enrollmentToken = adminExtras?.getString("enrollment_token")

Log.d(TAG, "Server URL: $serverUrl")
Log.d(TAG, "Enrollment Token: ${enrollmentToken?.take(8)}...")
```

**Because the QR code lacked `PROVISIONING_ADMIN_EXTRAS_BUNDLE`:**
- `adminExtras` = null
- `serverUrl` = null
- `enrollmentToken` = null

**Expected Log (MdmDeviceAdminReceiver.kt:54):**
```
Missing provisioning data! serverUrl=null, token=null
```

**Actual Behavior:**
- The callback was **NEVER CALLED** (no logs found with tag "MdmDeviceAdminReceiver")
- Android 10 doesn't call `onProfileProvisioningComplete()` when provisioning to Profile Owner mode
- The app started normally without provisioning callbacks

---

### 3. App Launch and Registration Attempt

When MainActivity launched, it checked for an enrollment token:

**MainActivity.kt:27-31**
```kotlin
val enrollmentToken = prefsManager.getEnrollmentToken()

if (enrollmentToken != null) {
    Log.d(TAG, "Found enrollment token, using DPC registration...")
    DeviceRegistration(this).registerDeviceWithToken(enrollmentToken)
}
```

**Actual Log:**
```
11-05 12:30:12.846 D/MainActivity: Found enrollment token, using DPC registration...
```

**Question:** Where did this token come from if the QR code didn't provide it?

**Answer:** Likely from a previous test run where provisioning worked, or cached SharedPreferences that were never cleared.

---

### 4. Registration Request

**DeviceRegistration.kt:125-133** builds the request:
```kotlin
val requestData = mapOf(
    "enrollmentToken" to enrollmentToken,
    "serialNumber" to serialNumber,
    "androidId" to androidId,
    "model" to Build.MODEL,
    "manufacturer" to Build.MANUFACTURER,
    "androidVersion" to Build.VERSION.RELEASE,
    "isDeviceOwner" to isDeviceOwner
)
```

**Actual Values Sent (from logcat):**
```
11-05 12:30:12.921 D/DeviceRegistration: Device Info - Serial: a79b604a2a873aea, Android ID: a79b604a2a873aea
11-05 12:30:12.922 D/DeviceRegistration: Is Device Owner: false
```

- serialNumber: `a79b604a2a873aea` (ANDROID_ID, since getSerial() threw SecurityException)
- androidId: `a79b604a2a873aea`
- isDeviceOwner: `false`
- model, manufacturer, androidVersion: Likely valid but not logged

---

### 5. Server Validation

**src/app/api/dpc/register/route.ts:40**
```typescript
if (!enrollmentToken || !serialNumber || !androidId || !model || !manufacturer || !androidVersion) {
  return NextResponse.json(
    { error: 'Missing required device information or enrollment token' },
    { status: 400 }
  )
}
```

**Server Response:**
```
11-05 12:30:13.657 D/DeviceRegistration: DPC registration response: 400
11-05 12:30:13.658 E/DeviceRegistration: DPC registration failed: {"error":"Missing required device information or enrollment token"}
```

**Likely Cause:**
One of the required fields (`enrollmentToken`, `serialNumber`, `androidId`, `model`, `manufacturer`, `androidVersion`) was:
- `null`
- `undefined`
- `""` (empty string)

**Most Likely Culprit:** The `enrollmentToken` was either:
1. Not sent (undefined)
2. Empty string
3. An old/invalid token from a previous test

---

## Secondary Issue: Profile Owner vs Device Owner

The app was provisioned as **Profile Owner (User 10)** instead of **Device Owner (User 0)**.

**Evidence:**
```
W/DeviceRegistration: SecurityException: getSerial: The user 10140 does not meet the requirements to access device identifiers.
```

**Why This Happened:**
Android 10 doesn't support the ProvisioningModeActivity that lets users choose between Device Owner and Work Profile modes. It defaults to Work Profile (Profile Owner) mode.

**Impact:**
- Profile Owner cannot access `Build.getSerial()` - gets SecurityException
- Code falls back to ANDROID_ID (which works)
- Limited device management capabilities compared to Device Owner

---

## Solution

### Option 1: Generate QR Code Using Web Portal (RECOMMENDED)

The web portal's QR generator (`src/app/actions/enrollment.ts`) correctly includes all required fields:

1. Navigate to the web portal
2. Select a policy
3. Click "Generate QR Code"
4. The generated QR will include `PROVISIONING_ADMIN_EXTRAS_BUNDLE` with server_url and enrollment_token

### Option 2: Manually Add Missing Fields

If manually creating QR JSON, ensure it includes:

```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/[storageId]",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "CREATE_TOKEN_VIA_WEB_PORTAL"
  }
}
```

**Important:** The enrollment token must be:
- Created via the web portal (Convex database)
- Associated with a valid policy
- Not expired or already used

---

## Device Owner Mode on Android 10

To provision as Device Owner instead of Profile Owner on Android 10:

### Requirements:
1. Device must be factory reset
2. No Google account added
3. No SIM card inserted (or in airplane mode)
4. First user (User 0) during OOBE

### Alternative for Testing:
Use Android 12+ which supports ProvisioningModeActivity (GET_PROVISIONING_MODE) that allows choosing Device Owner mode explicitly.

---

## Verification Steps

After generating correct QR code with `PROVISIONING_ADMIN_EXTRAS_BUNDLE`:

1. Factory reset device
2. Scan QR code during OOBE
3. Check logcat for:
   ```
   MdmDeviceAdminReceiver: Server URL: https://bbtec-mdm.vercel.app
   MdmDeviceAdminReceiver: Enrollment Token: tok_abc1...
   MdmDeviceAdminReceiver: Starting device registration with enrollment token...
   DeviceRegistration: DPC registration response: 200
   DeviceRegistration: Registration successful! Token saved.
   ```

---

## Key Files Referenced

1. **bbtec-mdm-qr-FINAL.json** - Missing PROVISIONING_ADMIN_EXTRAS_BUNDLE
2. **src/app/actions/enrollment.ts:89-92** - Correct QR generation with ADMIN_EXTRAS_BUNDLE
3. **android-client/.../MdmDeviceAdminReceiver.kt:29-36** - Extracts admin extras from intent
4. **android-client/.../DeviceRegistration.kt:125-133** - Builds registration request
5. **src/app/api/dpc/register/route.ts:40** - Server validation that rejected request

---

## Status

✅ **Root cause identified**
⏳ **Next step:** Generate new QR code using web portal and retest
📋 **Follow-up:** Document the correct QR generation workflow for future testing
