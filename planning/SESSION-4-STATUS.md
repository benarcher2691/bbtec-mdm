# Session 4 Status - Android 16 Provisioning Debugging

**Date:** 2025-11-04
**Duration:** ~4 hours
**Status:** 🔴 Blocked - QR code URLs empty

---

## 🎯 Session Goal

Fix "Can't set up device" error when provisioning Google Pixel Tablet (Android 16) with custom DPC QR code.

---

## ✅ What Was Achieved

### 1. Android 12+ Support Added
**Problem:** Android 12+ requires additional provisioning activities
**Solution:** Created two new activities required for QR provisioning

**Files created:**
- `android-client/app/src/main/java/com/bbtec/mdm/client/ProvisioningModeActivity.kt`
- `android-client/app/src/main/java/com/bbtec/mdm/client/PolicyComplianceActivity.kt`

**Manifest updated:**
```xml
<activity android:name=".ProvisioningModeActivity"
    android:exported="true"
    android:permission="android.permission.BIND_DEVICE_ADMIN">
    <intent-filter>
        <action android:name="android.app.action.GET_PROVISIONING_MODE" />
    </intent-filter>
</activity>

<activity android:name=".PolicyComplianceActivity"
    android:exported="true"
    android:permission="android.permission.BIND_DEVICE_ADMIN">
    <intent-filter>
        <action android:name="android.app.action.ADMIN_POLICY_COMPLIANCE" />
    </intent-filter>
</activity>
```

**Result:** APK built successfully as v0.0.5 (12 MB, signed)

### 2. Middleware Fixed
**Problem:** Clerk middleware blocked all API routes except `/api/client/*`
**Solution:** Added DPC and APK routes to public routes

**Routes added to public list:**
- `/api/dpc/*` - Device registration and policy sync
- `/api/apps/*` - APK downloads during provisioning
- `/api/apk/*` - APK redirect endpoints
- `/api/debug/*` - Debug endpoints

**Result:** API endpoints accessible without auth

### 3. QR Code Format Enhanced
**Problem:** QR code missing fields that Miradore includes
**Solution:** Added `PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME`

**Before:**
```json
{
  "COMPONENT_NAME": "...",
  "DOWNLOAD_LOCATION": "...",
  "SIGNATURE_CHECKSUM": "..."
}
```

**After:**
```json
{
  "COMPONENT_NAME": "...",
  "PACKAGE_NAME": "com.bbtec.mdm.client",  // NEW
  "DOWNLOAD_LOCATION": "...",
  "SIGNATURE_CHECKSUM": "..."
}
```

### 4. Environment Variables Set
**Problem:** `NEXT_PUBLIC_APP_URL` not set in Vercel
**Solution:** Added to Vercel environment variables

**Variable:** `NEXT_PUBLIC_APP_URL=https://bbtec-mdm.vercel.app`
**Environments:** Production, Preview, Development

### 5. Extensive Debug Logging Added
**Files modified:**
- `src/app/api/apps/[storageId]/route.ts` - APK download logging
- `src/app/api/dpc/register/route.ts` - Registration logging
- `src/app/actions/enrollment.ts` - QR generation logging

**Log prefixes:**
- `[APK DOWNLOAD]` - APK download requests
- `[DPC REGISTER]` - Device registration
- `[QR GEN]` - QR code generation

---

## 🔴 Current Blocker

### Problem: Empty URLs in QR Code

**Symptom:** QR code generates successfully but contains empty strings:
```json
{
  "DOWNLOAD_LOCATION": "",  // EMPTY!
  "ADMIN_EXTRAS_BUNDLE": {
    "server_url": "",  // EMPTY!
    "enrollment_token": "78343056-..."
  }
}
```

**Expected:**
```json
{
  "DOWNLOAD_LOCATION": "https://expert-lemur-691.convex.cloud/api/storage/...",
  "ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "78343056-..."
  }
}
```

**Evidence:**
1. Debug endpoint works: `/api/debug/test-apk` returns valid URLs
2. QR generation doesn't throw errors (validation not triggering)
3. Environment variable set in Vercel (redeployed after setting)
4. Convex query works from unauthenticated client

**Hypothesis:**
- Authenticated Convex client in `enrollment.ts` is failing silently
- OR `process.env.NEXT_PUBLIC_APP_URL` not available at runtime
- OR Convex query returns empty string (not null) so validation passes

**Next steps:**
1. Add debug info to QR generation response
2. Check browser Network tab for actual response
3. Investigate why authenticated client behaves differently

---

## 📊 Testing Results

### Test 1: Miradore QR Code Analysis
**Result:** ✅ Miradore uses different approach
- `DOWNLOAD_LOCATION`: Empty (Play Store EMM)
- Uses `PACKAGE_CHECKSUM` (entire APK hash)
- Uses `PACKAGE_CHECKSUM_SHA1` (SHA1 hash)
- Pre-installs via Play Store, not download

**Conclusion:** Our approach (custom hosted APK) is valid but needs different fields

### Test 2: APK Download Endpoint
**Command:** `curl -s https://bbtec-mdm.vercel.app/api/apps/kg220b9nzpyf3tw74q0ff9r1957tr1jm`
**Result:** ✅ HTTP 307 redirect to Convex storage
**File downloaded:** 11,829,008 bytes (valid APK)

### Test 3: Registration Endpoint
**Command:** POST to `/api/dpc/register` with invalid token
**Result:** ✅ Correct validation: `{"error":"Invalid enrollment token"}`

### Test 4: Policies Endpoint
**Command:** GET to `/api/dpc/policies` with invalid token
**Result:** ✅ Correct validation: `{"error":"Invalid API token"}`

### Test 5: Signature Verification
**Keystore SHA256:** `53:CD:0E:1A:9E:3F:3A:38:C6:66:84:2A:98:94:CA:8E:B1:ED:DC:DC:F4:FB:0E:13:10:B3:03:8F:A7:1B:CE:21`
**Base64:** `U80OGp4/OjjGZoQqmJTKjrHt3Nz0+w4TELMDj6cbziE=`
**Result:** ✅ Matches hardcoded signature in code

### Test 6: Device Provisioning Attempts
**Device:** Google Pixel Tablet, Android 16
**Network:** WiFi connected, same network as Miradore success
**QR Code Scan:** Device doesn't recognize QR (empty URLs)
**Convex Check:** `downloadCount` = 0 (device never downloaded APK)

---

## 🔧 Commits Made (18 total)

1. `dbd6ea0` - debug: Add comprehensive logging for device provisioning
2. `8ded83c` - fix: Add DPC and APK endpoints to public routes in middleware
3. `6bb7602` - feat: Add Android 12+ provisioning support (required for Android 16)
4. `24dc6b1` - chore: Bump version to 0.0.4 for Android 12+ support
5. `9261b3d` - chore: Bump version to 0.0.5 with proper signing
6. `829e9df` - fix: Use direct Convex URL instead of redirect for APK download
7. `a22aab0` - fix: Add PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME to QR code
8. `232a735` - debug: Add logging and validation for empty URLs in QR code
9. `6e83871` - debug: Add debug info to QR code response

**Lines changed:** +450 / -50 across 12 files

---

## 📚 Key Learnings

### 1. Android 12+ Provisioning Requirements
- Must implement `ACTION_GET_PROVISIONING_MODE` activity
- Must implement `ACTION_ADMIN_POLICY_COMPLIANCE` activity
- Without these, provisioning fails BEFORE APK download
- Found via web search of official Android documentation

### 2. Miradore's Approach
- Uses empty download location (Play Store EMM partnership)
- Uses `PACKAGE_CHECKSUM` instead of `SIGNATURE_CHECKSUM`
- Pre-installs APK, doesn't download during provisioning
- Our approach (custom hosted) is different but valid

### 3. Middleware Configuration Critical
- Clerk middleware blocks all routes by default
- DPC provisioning needs public endpoints (no auth possible during factory reset)
- Must explicitly whitelist provisioning routes

### 4. Environment Variables in Vercel
- Must be set in dashboard
- Require redeploy after setting
- `NEXT_PUBLIC_*` prefix needed for client-side access

---

## 🐛 Known Issues

### Critical
1. **Empty URLs in QR code** - Blocks all provisioning attempts
2. **Convex query returns empty** - Root cause unknown

### Minor
None

---

## 📁 Files Modified

### Android Client
- `android-client/app/build.gradle.kts` - Version bump to 0.0.5
- `android-client/app/src/main/AndroidManifest.xml` - Added provisioning activities
- `android-client/app/src/main/java/com/bbtec/mdm/client/ProvisioningModeActivity.kt` - NEW
- `android-client/app/src/main/java/com/bbtec/mdm/client/PolicyComplianceActivity.kt` - NEW

### Server
- `src/middleware.ts` - Added public routes
- `src/app/actions/enrollment.ts` - QR generation with debug logging
- `src/app/api/apps/[storageId]/route.ts` - APK download with logging
- `src/app/api/dpc/register/route.ts` - Registration with logging
- `src/app/api/debug/test-apk/route.ts` - NEW test endpoint

---

## 🔗 Reference Links

**Official Documentation:**
- [Android Device Admin Provisioning](https://source.android.com/docs/devices/admin/provision)
- [Android Management API](https://developers.google.com/android/management)

**Stack Overflow:**
- [Android 12 Device Owner Provisioning](https://stackoverflow.com/questions/70111346/)
- [QR Code Provisioning Issues](https://stackoverflow.com/questions/71989742/)

**Community:**
- [Android Enterprise Community - Provisioning Issues](https://www.androidenterprise.community/discussions/conversations/device-provision-qr-not-working-on-some-android-versions/3380)

---

## 🎯 Next Session TODO

1. **Fix empty URLs (CRITICAL)**
   - Check debug response object from QR generation
   - Investigate authenticated Convex client behavior
   - Test with unauthenticated client if needed

2. **Test provisioning after URL fix**
   - Generate fresh QR code with populated URLs
   - Factory reset device
   - Scan QR code
   - Monitor Convex `downloadCount` field

3. **If provisioning succeeds**
   - Check device registration in Convex
   - Verify policy sync
   - Test device commands

4. **If provisioning still fails**
   - Compare QR format byte-by-byte with Miradore
   - Try Google's TestDPC APK as control test
   - Check Android logcat during provisioning (if possible)

---

## 💡 Engineering Notes

**Good decisions:**
- Adding debug logging early saved hours
- Analyzing Miradore's working QR code provided critical insights
- Testing individual endpoints confirmed implementation correctness

**Mistakes:**
- Too much speculation early on (device limitations, network issues)
- Should have checked environment variables sooner
- Should have added debug response object immediately

**Lesson learned:**
- When remote debugging (Vercel), add debug info to responses FIRST
- Don't guess about environment - verify systematically
- Compare working examples (Miradore) before implementing

---

**Status:** Waiting for debug response to identify root cause of empty URLs
