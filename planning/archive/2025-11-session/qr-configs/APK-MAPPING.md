# APK to QR Code Mapping

This document maps APK files to their Convex storage IDs and corresponding QR code configurations.

**Purpose:** Enable exact reproduction of test scenarios by documenting the complete chain:
`APK file → Upload → Storage ID → QR Code → Test Result`

---

## 1. TestDPC v9.0.12 (Baseline Test - SUCCESS ✅)

### APK File
- **Filename:** `com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk`
- **Location:** `artifacts/apks/` (version controlled)
- **Size:** 11,054,659 bytes (10.5 MB)
- **Downloaded:** 2025-11-05 11:13
- **Source:** APKMirror (official Google sample)
- **Download URL:** https://www.apkmirror.com/apk/google-inc/test-dpc/test-dpc-9-0-12-release/
  - Navigate to APKMirror TestDPC page
  - Download version 9.0.12 (released Dec 2023)
  - Variant: universal (minAPI21, nodpi)
- **Package Name:** `com.afwsamples.testdpc`
- **Version:** 9.0.12 (build 9012)
- **SHA256:** (verify with: `sha256sum com.afwsamples.testdpc_*.apk`)

### Upload Details
- **Upload Date:** 2025-11-05
- **Uploaded To:** Convex storage via web portal
- **Convex Storage ID:** `kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj`
- **Download URL:** `https://bbtec-mdm.vercel.app/api/apps/kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj`

### Signature
- **Algorithm:** SHA-256
- **Format:** Base64 URL-safe (RFC 4648), no padding
- **Checksum:** `gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w`
- **Verification Command:**
  ```bash
  keytool -printcert -jarfile com.afwsamples.testdpc_*.apk | grep SHA256 | awk '{print $2}' | xxd -r -p | base64 | tr '+/' '-_' | tr -d '='
  ```

### QR Code Configuration
- **File:** `planning/qr-configs/testdpc-success.json`
- **Generated:** 2025-11-05
- **Content:**
  ```json
  {
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.afwsamples.testdpc/com.afwsamples.testdpc.DeviceAdminReceiver",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.afwsamples.testdpc",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w",
    "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
  }
  ```

### Test Result
- **Date:** 2025-11-05
- **Device:** Hannspree Zeus, Android 10
- **Status:** ✅ SUCCESS
- **Provisioning Mode:** Device Owner (User 0)
- **Evidence:**
  ```
  dumpsys device_policy:
  Device Owner (User 0): com.afwsamples.testdpc
  Profile Owner (User 10): null
  ```

### How to Reproduce
1. Factory reset Android device
2. During OOBE, tap 6 times on welcome screen
3. Scan QR code generated from `planning/qr-configs/testdpc-success.json`
4. TestDPC should download, install, and become Device Owner

---

## 2. BBTec MDM Client v0.0.8 (Missing Admin Extras - FAILED ❌)

### APK File
- **Filename:** `bbtec-mdm-client-0.0.8.apk`
- **Location:** `artifacts/apks/` (version controlled)
- **Size:** 11,832,505 bytes (11.3 MB)
- **Build Date:** 2025-11-04 14:55
- **Source:** Built from `android-client/` directory
- **Git Commit:** `01dde47` (fix: Add missing intent-filter actions to DeviceAdminReceiver)
- **Package Name:** `com.bbtec.mdm.client`
- **Version:** 0.0.8 (versionCode: 8)
- **Build Commands:**
  ```bash
  # Checkout specific commit
  git checkout 01dde47

  # Build release APK
  cd android-client
  ./gradlew clean assembleRelease

  # Sign APK with development keystore
  jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
    -keystore bbtec-mdm.keystore -storepass android -keypass android \
    app/build/outputs/apk/release/app-release.apk bbtec-mdm

  # Verify signature
  jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk

  # Copy to artifacts with version tag
  cp app/build/outputs/apk/release/app-release.apk ../artifacts/apks/bbtec-mdm-client-0.0.8.apk
  ```

### Upload Details
- **Upload Date:** 2025-11-04
- **Uploaded To:** Convex storage via web portal
- **Convex Storage ID:** `kg2c0n5m61jc01hx00crgs3pmd7tr64z`
- **Download URL:** `https://bbtec-mdm.vercel.app/api/apps/kg2c0n5m61jc01hx00crgs3pmd7tr64z`

### Signature
- **Keystore:** `android-client/bbtec-mdm.keystore`
- **Alias:** `bbtec-mdm`
- **Algorithm:** SHA-256
- **Format:** Base64 URL-safe (RFC 4648), no padding
- **Checksum:** `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE`
- **Verification Command:**
  ```bash
  keytool -list -v -keystore android-client/bbtec-mdm.keystore \
    -storepass android -alias bbtec-mdm | grep SHA256 | awk '{print $2}' | \
    xxd -r -p | base64 | tr '+/' '-_' | tr -d '='
  ```

### QR Code Configuration (BROKEN)
- **File:** `planning/qr-configs/bbtec-broken-missing-extras.json`
- **Generated:** 2025-11-05
- **Issue:** Missing `PROVISIONING_ADMIN_EXTRAS_BUNDLE`
- **Content:**
  ```json
  {
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2c0n5m61jc01hx00crgs3pmd7tr64z",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
    "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false
  }
  ```

### Test Result
- **Date:** 2025-11-05
- **Device:** Hannspree Zeus, Android 10
- **Status:** ❌ PARTIAL - Provisioned but registration failed
- **Provisioning Mode:** Profile Owner (User 10)
- **Error:** HTTP 400 - "Missing required device information or enrollment token"
- **Root Cause:** QR code missing `PROVISIONING_ADMIN_EXTRAS_BUNDLE` with `server_url` and `enrollment_token`
- **Evidence:**
  ```
  11-05 12:30:13.657 D/DeviceRegistration: DPC registration response: 400
  11-05 12:30:13.658 E/DeviceRegistration: DPC registration failed: {"error":"Missing required device information or enrollment token"}
  ```

### Correct QR Code Format (NOT TESTED YET)
For this APK to work correctly, the QR code MUST include admin extras:
```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://bbtec-mdm.vercel.app/api/apps/kg2c0n5m61jc01hx00crgs3pmd7tr64z",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://bbtec-mdm.vercel.app",
    "enrollment_token": "tok_[GENERATE_VIA_WEB_PORTAL]"
  }
}
```

**Generate via web portal:** https://bbtec-mdm.vercel.app

---

## 🔄 Rebuild Instructions

### To Recreate TestDPC Test

1. **Download TestDPC v9.0.12:**

   **Option A: Use artifacts (recommended)**
   ```bash
   # APK is version controlled in: artifacts/apks/com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk
   ```

   **Option B: Download fresh from APKMirror**
   ```bash
   # Navigate to: https://www.apkmirror.com/apk/google-inc/test-dpc/test-dpc-9-0-12-release/
   # Download: test-dpc-9-0-12-release (universal variant, nodpi, minAPI 21)
   # Save as: com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk

   # Verify signature checksum matches:
   keytool -printcert -jarfile com.afwsamples.testdpc_*.apk | grep SHA256 | \
     awk '{print $2}' | xxd -r -p | base64 | tr '+/' '-_' | tr -d '='
   # Expected: gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w
   ```

2. **Upload to Convex (if needed):**
   - Navigate to https://bbtec-mdm.vercel.app
   - Upload APK via web portal
   - Note the new storage ID

3. **Generate QR code:**
   ```bash
   # Use planning/qr-configs/testdpc-success.json as template
   # Update PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION with new storage ID if changed
   ```

4. **Test:**
   - Factory reset device
   - Scan QR during OOBE
   - Verify Device Owner mode

### To Recreate BBTec MDM Test (Correct Version)

1. **Build APK from specific commit:**

   **Option A: Use artifacts (recommended)**
   ```bash
   # APK is version controlled in: artifacts/apks/bbtec-mdm-client-0.0.8.apk
   ```

   **Option B: Rebuild from source**
   ```bash
   # Checkout the exact commit used for v0.0.8
   git checkout 01dde47

   # Build release APK
   cd android-client
   ./gradlew clean assembleRelease

   # Sign APK with development keystore
   jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
     -keystore bbtec-mdm.keystore -storepass android -keypass android \
     app/build/outputs/apk/release/app-release.apk bbtec-mdm

   # Verify signature
   jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk

   # Verify checksum matches
   keytool -list -v -keystore bbtec-mdm.keystore -storepass android -alias bbtec-mdm | \
     grep SHA256 | awk '{print $2}' | xxd -r -p | base64 | tr '+/' '-_' | tr -d '='
   # Expected: U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE

   # Copy to artifacts with version tag
   cp app/build/outputs/apk/release/app-release.apk ../artifacts/apks/bbtec-mdm-client-0.0.8.apk

   # Return to latest code
   git checkout master
   ```

2. **Extract signature checksum:**
   ```bash
   keytool -list -v -keystore android-client/bbtec-mdm.keystore \
     -storepass android -alias bbtec-mdm | grep SHA256 | awk '{print $2}' | \
     xxd -r -p | base64 | tr '+/' '-_' | tr -d '='
   ```

3. **Upload via web portal:**
   - Navigate to https://bbtec-mdm.vercel.app
   - Upload APK
   - Note the storage ID

4. **Generate QR code via web portal:**
   - Select a policy
   - Click "Generate QR Code"
   - This automatically includes `PROVISIONING_ADMIN_EXTRAS_BUNDLE`

5. **Test:**
   - Factory reset device
   - Scan QR during OOBE
   - Verify app provisions AND registers successfully

---

## 📋 Quick Reference Table

| APK File | Version | Storage ID | Signature Checksum | QR Config | Status |
|----------|---------|------------|-------------------|-----------|--------|
| `com.afwsamples.testdpc_*.apk` | 9.0.12 | `kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj` | `gJD2Y...M9w` | `testdpc-success.json` | ✅ Works |
| `bbtec-mdm-client-0.0.8.apk` | 0.0.8 | `kg2c0n5m61jc01hx00crgs3pmd7tr64z` | `U80OG...ziE` | `bbtec-broken-*.json` | ❌ Broken |

---

## 🔐 Keystore Backup (CRITICAL)

**⚠️ WARNING:** The keystore file `android-client/bbtec-mdm.keystore` is **NOT version controlled** for security reasons but is **REQUIRED** to reproduce v0.0.8.

### Why Keystore Matters

Without the original keystore:
- ❌ Cannot rebuild v0.0.8 with matching signature checksum
- ❌ QR codes will fail (signature mismatch)
- ❌ Cannot update existing provisioned devices (Android requires same signature)
- ✅ Can still build NEW APKs (but with different signatures)

### Keystore Details

- **Location:** `android-client/bbtec-mdm.keystore` (gitignored)
- **Alias:** `bbtec-mdm`
- **Password:** `android` (both store and key)
- **Algorithm:** RSA 2048-bit
- **Validity:** 10000 days from creation
- **Signature Checksum:** `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE`

### Backup Instructions

**IMPORTANT:** Store keystore in secure location:
1. **Password manager** (recommended for team access)
2. **Encrypted storage** (hardware-encrypted drive)
3. **Secure cloud storage** (encrypted, access-controlled)

**Backup command:**
```bash
# Create encrypted backup
gpg --symmetric --cipher-algo AES256 android-client/bbtec-mdm.keystore
# Produces: bbtec-mdm.keystore.gpg (safe to store anywhere)
```

**Restore command:**
```bash
# Decrypt keystore
gpg --decrypt bbtec-mdm.keystore.gpg > android-client/bbtec-mdm.keystore
```

### Reproducibility Status

**With artifacts only (current state):**
- ✅ Can use exact v0.0.8 APK from `artifacts/apks/`
- ✅ Can generate working QR codes (using stored APK)
- ❌ Cannot rebuild from source with same signature

**With artifacts + keystore backup:**
- ✅ Full reproducibility from git commit `01dde47`
- ✅ Can rebuild v0.0.8 with identical signature
- ✅ Can create new versions that update existing devices

---

## 📚 Related Documentation

- **QR Code Configs:** `planning/qr-configs/README.md`
- **Root Cause Analysis:** `planning/REGISTRATION-FAILURE-ROOT-CAUSE.md`
- **Session Status:** `planning/SESSION-4-STATUS.md`
- **TestDPC Instructions:** `planning/TESTDPC-BASELINE-TEST.md`

---

**Last Updated:** 2025-11-05
