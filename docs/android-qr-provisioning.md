# Android QR Code Provisioning - Technical Reference

**Last Updated:** 2025-11-05
**Target Audience:** Engineering team members working on MDM implementation

---

## Table of Contents

1. [Overview](#overview)
2. [How QR Provisioning Works](#how-qr-provisioning-works)
3. [QR Code Format & Required Fields](#qr-code-format--required-fields)
4. [Android Version Differences](#android-version-differences)
5. [APK Requirements](#apk-requirements)
6. [The Provisioning Flow](#the-provisioning-flow)
7. [Common Issues & Solutions](#common-issues--solutions)
8. [Testing & Debugging](#testing--debugging)
9. [Official Documentation Links](#official-documentation-links)

---

## Overview

Android QR code provisioning allows organizations to set up company-owned devices in **Device Owner** or **Managed Profile** (Work Profile) mode by scanning a QR code during the factory reset setup wizard.

### What is Device Owner Mode?

**Device Owner** gives the MDM complete control over the device:
- Full device management (lock, wipe, reboot)
- System-level policy enforcement
- Silent app installation
- Complete control over device settings
- Cannot be removed by the user without factory reset

**Key Requirement:** Must be set up during initial device setup (factory reset state)

### Use Cases

1. **Corporate device provisioning** - Bulk setup of company-owned devices
2. **Kiosk mode devices** - Locked-down devices for single-purpose use
3. **BYOD work profiles** - Separate work and personal data (Managed Profile mode)

---

## How QR Provisioning Works

### High-Level Flow

```
┌─────────────────┐
│  Factory Reset  │
│     Device      │
└────────┬────────┘
         │
         │ 1. User taps screen 6 times
         │    during setup wizard
         ▼
┌─────────────────┐
│  QR Scanner     │
│   Activated     │
└────────┬────────┘
         │
         │ 2. Scan QR code containing
         │    provisioning JSON
         ▼
┌─────────────────┐
│  Parse JSON &   │
│  Validate Data  │
└────────┬────────┘
         │
         │ 3. Download APK from URL
         │    in QR code
         ▼
┌─────────────────┐
│  Verify APK     │
│   Signature     │
└────────┬────────┘
         │
         │ 4. Install DPC APK as
         │    Device Owner
         ▼
┌─────────────────┐
│  Launch DPC &   │
│  Complete Setup │
└────────┬────────┘
         │
         │ 5. Device registers with
         │    MDM server
         ▼
┌─────────────────┐
│  Device Ready   │
│  (Managed)      │
└─────────────────┘
```

### Step-by-Step Technical Process

1. **User initiates QR provisioning** (taps screen 6 times on "Welcome" screen)
2. **Android scans QR code** and parses JSON string
3. **Android validates JSON** format and required fields
4. **Android downloads APK** from `PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION`
5. **Android verifies signature** matches `PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM`
6. **Android 12+ calls provisioning activities** (if implemented):
   - `ACTION_GET_PROVISIONING_MODE` - Choose Device Owner vs Work Profile
   - `ACTION_ADMIN_POLICY_COMPLIANCE` - Policy setup
7. **Android installs APK** as Device Admin (privileged mode)
8. **Android calls DPC receiver** `onProfileProvisioningComplete()` or `onDeviceOwnerEnabled()`
9. **DPC registers device** with MDM server using enrollment token from QR extras
10. **Device begins managed operation** - policies enforced, ready for commands

---

## QR Code Format & Required Fields

### JSON Structure

The QR code must contain a **JSON string** (not JSON object) with specific Android-recognized keys.

```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.example.mdm/.DeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.example.mdm",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://example.com/apk",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "https://example.com",
    "enrollment_token": "uuid-token-here"
  }
}
```

### Required Fields Explained

| Field | Required | Description | Notes |
|-------|----------|-------------|-------|
| `PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME` | ✅ Yes | Full qualified component name of DeviceAdminReceiver | Format: `package/package.ClassName` (Android 13+) |
| `PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME` | ✅ Yes | Package name of DPC APK | Must match APK's package name |
| `PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION` | ✅ Yes | HTTPS URL to download APK | Must be publicly accessible (no auth) |
| `PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM` | ✅ Yes | SHA-256 hash of APK signing certificate | **Must be URL-safe base64 without padding** |
| `PROVISIONING_SKIP_ENCRYPTION` | ⚠️ Optional | Whether to skip device encryption | Default: false (encrypt device) |
| `PROVISIONING_ADMIN_EXTRAS_BUNDLE` | ⚠️ Optional | Custom data passed to DPC | MDM server URL, enrollment token, etc. |

### Critical: Signature Checksum Format

⚠️ **The signature checksum MUST use URL-safe base64 encoding without padding (RFC 4648 base64url):**

**Standard base64:**
```
U80OGp4/OjjGZoQqmJTKjrHt3Nz0+w4TELMDj6cbziE=
```

**URL-safe base64 (REQUIRED):**
```
U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE
```

**Conversion:**
- Replace `+` with `-`
- Replace `/` with `_`
- Remove `=` padding

**Why this matters:** Without this exact format, Android shows "Downloading..." but never contacts the server (0 downloads).

### Component Name Format

The component name format varies by Android version:

**Shorthand format (Android 10-12):**
```json
"PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/.MdmDeviceAdminReceiver"
```

**Full qualified name (Android 13+):**
```json
"PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver"
```

⚠️ **Recommendation:** Use full qualified name for all versions - Android 10-12 accept both formats, but Android 13+ requires full name.

---

## Android Version Differences

### Android 10 (API 29) and Earlier

**Characteristics:**
- Simple provisioning flow
- `ProvisioningModeActivity` NOT called
- Often defaults to **Profile Owner (Work Profile)** instead of Device Owner
- No explicit Device Owner vs Work Profile selection

**Known Issues:**
- May create Work Profile (Profile Owner) instead of Device Owner when using QR provisioning
- Callback `onProfileProvisioningComplete()` may not fire consistently

**Workaround:**
- Implement registration fallback in main activity
- Check for enrollment token, register if not already registered

**Verification:**
```bash
adb shell dumpsys device_policy
# Device Owner: "Device Owner: com.example.mdm"
# Profile Owner: "Profile Owner (User 10): com.example.mdm"
```

### Android 11-12 (API 30-31)

**Characteristics:**
- Similar to Android 10
- Better handling of component names
- Still no provisioning mode selection

### Android 12+ (API 31+) - Major Changes

**New Requirements:**

1. **Must implement `ACTION_GET_PROVISIONING_MODE` activity:**
   ```kotlin
   class ProvisioningModeActivity : Activity() {
       override fun onCreate(savedInstanceState: Bundle?) {
           super.onCreate(savedInstanceState)

           // Return Device Owner mode (not Work Profile)
           val result = Intent().apply {
               putExtra(EXTRA_PROVISIONING_MODE, PROVISIONING_MODE_FULLY_MANAGED_DEVICE)
           }
           setResult(RESULT_OK, result)
           finish()
       }
   }
   ```

2. **Must implement `ACTION_ADMIN_POLICY_COMPLIANCE` activity:**
   ```kotlin
   class PolicyComplianceActivity : Activity() {
       override fun onCreate(savedInstanceState: Bundle?) {
           super.onCreate(savedInstanceState)

           // Acknowledge policy compliance
           setResult(RESULT_OK)
           finish()
       }
   }
   ```

**AndroidManifest.xml:**
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

**Without these activities:** Provisioning fails BEFORE APK download on Android 12+.

### Android 13 (API 33)

**Key Changes:**
- Requires **full qualified component name** (not shorthand)
- Stricter APK signature verification
- More detailed error messages: "Can't use the admin app. it is missing components or corrupted"

**Component name requirement:**
```json
// ❌ FAILS on Android 13
"COMPONENT_NAME": "com.bbtec.mdm.client/.MdmDeviceAdminReceiver"

// ✅ WORKS on Android 13
"COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver"
```

### Android 16 (API 35 - Beta)

**Status:** Currently in beta, limited testing performed

**Known Considerations:**
- Should work with URL-safe base64 signature fix
- May have additional provisioning requirements (TBD)
- Beta instability makes testing unreliable

**Recommendation:** Wait for stable release before extensive testing.

---

## APK Requirements

### AndroidManifest.xml Requirements

Your DPC APK must declare specific components and permissions:

#### 1. Device Admin Receiver

```xml
<receiver
    android:name=".MdmDeviceAdminReceiver"
    android:exported="true"
    android:permission="android.permission.BIND_DEVICE_ADMIN">
    <meta-data
        android:name="android.app.device_admin"
        android:resource="@xml/device_admin" />
    <intent-filter>
        <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
        <action android:name="android.app.action.PROFILE_PROVISIONING_COMPLETE" />
        <action android:name="android.app.action.ACTION_DEVICE_OWNER_CHANGED" />
        <action android:name="android.app.action.DEVICE_ADMIN_DISABLE_REQUESTED" />
        <action android:name="android.app.action.DEVICE_ADMIN_DISABLED" />
    </intent-filter>
</receiver>
```

**Critical:** All 5 intent-filter actions must be present:
1. `DEVICE_ADMIN_ENABLED` - When device admin is enabled
2. `PROFILE_PROVISIONING_COMPLETE` - When provisioning completes
3. `ACTION_DEVICE_OWNER_CHANGED` - When device owner is set
4. `DEVICE_ADMIN_DISABLE_REQUESTED` - When user tries to disable
5. `DEVICE_ADMIN_DISABLED` - When device admin is disabled

#### 2. Device Admin Policies XML

`res/xml/device_admin.xml`:
```xml
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <limit-password />
        <watch-login />
        <reset-password />
        <force-lock />
        <wipe-data />
        <expire-password />
        <encrypted-storage />
        <disable-camera />
        <disable-keyguard-features />
    </uses-policies>
</device-admin>
```

#### 3. Provisioning Activities (Android 12+)

See [Android 12+ section](#android-12-api-31---major-changes) above.

#### 4. Required Permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### DeviceAdminReceiver Implementation

```kotlin
class MdmDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)

        // Extract enrollment token from QR extras
        val extras = intent.getParcelableExtra<PersistableBundle>(
            EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
        )
        val enrollmentToken = extras?.getString("enrollment_token")
        val serverUrl = extras?.getString("server_url")

        // Register device with MDM server
        DeviceRegistration.registerWithToken(context, serverUrl, enrollmentToken)
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Device admin enabled")
    }
}
```

### APK Signing

⚠️ **Critical:** APK must be signed with a valid keystore.

**Generate keystore:**
```bash
keytool -genkeypair -v \
  -keystore my-mdm.keystore \
  -alias my-mdm \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass android \
  -keypass android \
  -dname "CN=My MDM, OU=Development, O=MyCompany, L=City, ST=State, C=US"
```

**Sign APK:**
```bash
# Build unsigned APK
./gradlew assembleRelease

# Sign with jarsigner
jarsigner -verbose \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore my-mdm.keystore \
  -storepass android \
  -keypass android \
  app/build/outputs/apk/release/app-release.apk \
  my-mdm

# Verify signature
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk
```

**Extract signature checksum:**
```bash
# Get certificate SHA-256 hash
keytool -list -v -keystore my-mdm.keystore -storepass android -alias my-mdm | \
  grep "SHA256:" | \
  awk '{print $2}' | \
  sed 's/://g' | \
  xxd -r -p | \
  base64 | \
  tr '+/' '-_' | \
  tr -d '='
```

Result (example): `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE`

---

## The Provisioning Flow

### Detailed Sequence Diagram

```
User                Android Setup      APK Server         MDM Server         DPC App
 |                       |                  |                  |                  |
 |--Tap 6 times--------->|                  |                  |                  |
 |                       |                  |                  |                  |
 |--Scan QR code-------->|                  |                  |                  |
 |                       |                  |                  |                  |
 |                       |--Parse JSON----->|                  |                  |
 |                       |                  |                  |                  |
 |                       |--Download APK--->|                  |                  |
 |                       |<--Return APK-----|                  |                  |
 |                       |                  |                  |                  |
 |                       |--Verify signature|                  |                  |
 |                       |  (checksum match)|                  |                  |
 |                       |                  |                  |                  |
 |                       |--Install APK---->|                  |                  |
 |                       |                  |                  |                  |
 |                       |--Launch provisioning mode activity->|                  |
 |                       |<-Return FULLY_MANAGED_DEVICE--------|                  |
 |                       |                  |                  |                  |
 |                       |--Set Device Owner|                  |                  |
 |                       |                  |                  |                  |
 |                       |--Call onProfileProvisioningComplete->|                  |
 |                       |                  |                  |                  |
 |                       |                  |                  |--Register------->|
 |                       |                  |                  |  (enrollment     |
 |                       |                  |                  |   token)         |
 |                       |                  |                  |<-Policies--------|
 |                       |                  |                  |                  |
 |                       |--Setup complete->|                  |                  |
 |<--Device ready--------|                  |                  |                  |
```

### Key Points

1. **Network Requirements:**
   - APK download URL must be HTTPS and publicly accessible (no authentication)
   - Device must have WiFi connectivity during provisioning
   - MDM server registration endpoint must be publicly accessible

2. **Security:**
   - APK signature verification prevents tampering
   - Enrollment token in QR extras provides one-time authentication
   - Token should expire after first use (1 hour recommended)

3. **Timing:**
   - Entire provisioning takes 2-5 minutes depending on APK size and network speed
   - APK download is typically the longest step (our 12MB APK takes ~30 seconds)

---

## Common Issues & Solutions

### Issue 1: "Can't set up device"

**Symptoms:** Error immediately after scanning QR code, before download

**Causes:**
- Invalid JSON format in QR code
- Missing required fields
- Component name not found in APK
- Android 12+ missing provisioning activities

**Solutions:**
1. Validate JSON format with online validator
2. Check all required fields present
3. Verify component name matches manifest exactly
4. Add `ProvisioningModeActivity` and `PolicyComplianceActivity` for Android 12+

### Issue 2: "Downloading..." Forever (0 Downloads)

**Symptoms:** Device shows "Downloading..." but APK never downloads (server shows 0 downloads)

**Cause:** Signature checksum not in URL-safe base64 format

**Solution:**
```python
# Convert standard base64 to URL-safe
checksum = standard_base64.replace('+', '-').replace('/', '_').rstrip('=')
```

### Issue 3: "Can't use the admin app. Missing components or corrupted"

**Symptoms:** APK downloads and installs, but provisioning fails with this error

**Causes:**
- Component name format incorrect (shorthand on Android 13)
- Missing intent-filter actions on DeviceAdminReceiver
- APK not properly signed
- Missing device_admin.xml

**Solutions:**
1. Use full qualified component name: `com.pkg/com.pkg.Receiver`
2. Verify all 5 intent-filter actions present
3. Re-sign APK with jarsigner, verify with `jarsigner -verify`
4. Check `res/xml/device_admin.xml` exists

### Issue 4: Profile Owner Instead of Device Owner (Android 10)

**Symptoms:** Device provisions successfully but has limited control (Work Profile)

**Verification:**
```bash
adb shell dumpsys device_policy
# Should show: "Device Owner: com.example.mdm"
# NOT: "Profile Owner (User 10): com.example.mdm"
```

**Cause:** Android 10 doesn't call `ProvisioningModeActivity`, defaults to Work Profile

**Solution:**
- Try different QR parameters (PROVISIONING_MODE extra)
- Accept limitation for Android 10 (EOL since 2019)
- Implement fallback registration in MainActivity

### Issue 5: Empty URLs in QR Code

**Symptoms:** QR JSON has empty strings for APK URL or server URL

**Causes:**
- Environment variables not set or set to empty string
- Convex storage query returning null
- Authenticated client issues in API routes

**Solutions:**
1. Verify environment variables in deployment platform
2. Check APK actually uploaded and marked as current in database
3. Add validation - fail fast if URLs empty before generating QR

---

## Testing & Debugging

### Testing Checklist

- [ ] Factory reset test device
- [ ] Generate fresh QR code (new enrollment token)
- [ ] Verify QR JSON contains all fields (no empty strings)
- [ ] Verify signature checksum is URL-safe base64
- [ ] Scan QR during setup (tap screen 6 times on Welcome)
- [ ] Monitor APK server logs for download request
- [ ] Check device installs APK successfully
- [ ] Verify device appears in MDM portal after provisioning
- [ ] Check device owner status with `adb shell dumpsys device_policy`

### Debug Commands

**View device policy status:**
```bash
adb shell dumpsys device_policy
```

**View logcat during provisioning:**
```bash
adb logcat | grep -i "provision"
```

**Check installed packages:**
```bash
adb shell pm list packages | grep mdm
```

**Verify APK signature:**
```bash
jarsigner -verify -verbose -certs your-app.apk
```

**View APK manifest:**
```bash
aapt dump xmltree your-app.apk AndroidManifest.xml
```

**Extract certificate from APK:**
```bash
unzip -p your-app.apk META-INF/*.RSA | keytool -printcert
```

### QR Code Testing

**Recommended QR settings:**
- Error correction level: M (15% - Medium)
- Size: 512×512 pixels minimum
- Format: PNG or SVG
- Print quality: 300 DPI minimum for physical prints

**Validate QR content:**
```bash
# Decode QR code image
zbarimg your-qr.png
```

### Network Monitoring

**Test APK download:**
```bash
curl -v https://your-server.com/api/apps/storage-id
```

**Verify headers:**
- Should return HTTP 200 or 307 (redirect)
- Content-Type: application/vnd.android.package-archive
- Must be HTTPS (not HTTP)

---

## Official Documentation Links

### Android Developer Documentation

- [Device Administration Overview](https://developer.android.com/guide/topics/admin/device-admin)
- [Android Enterprise Provisioning](https://developers.google.com/android/management/provision-device)
- [QR Code Provisioning](https://developers.google.com/android/management/provision-device#qr_code_method)
- [DeviceAdminReceiver API Reference](https://developer.android.com/reference/android/app/admin/DeviceAdminReceiver)
- [DevicePolicyManager API Reference](https://developer.android.com/reference/android/app/admin/DevicePolicyManager)

### Android Enterprise

- [Android Enterprise Help Center](https://support.google.com/work/android)
- [Zero-Touch Enrollment](https://www.android.com/enterprise/management/zero-touch/)
- [Provisioning Methods Comparison](https://developers.google.com/android/management/provision-device#provisioning_methods)

### Community Resources

- [Android Enterprise Community](https://www.androidenterprise.community/)
- [TestDPC - Google's Reference DPC](https://github.com/googlesamples/android-testdpc)
- [Android Management API Samples](https://github.com/google/android-management-api-samples)

### Stack Overflow Discussions

- [Android 12 Device Owner Provisioning](https://stackoverflow.com/questions/70111346/)
- [QR Code Provisioning Issues](https://stackoverflow.com/questions/71989742/)
- [Device Admin Signature Checksum](https://stackoverflow.com/questions/42826063/)

### RFC Standards

- [RFC 4648 - Base64url Encoding](https://datatracker.ietf.org/doc/html/rfc4648#section-5)

---

## Appendix: Version History & Known Issues

### Our Project Status (as of 2025-11-05)

| Android Version | Status | Notes |
|-----------------|--------|-------|
| Android 10 | ✅ Partial | APK downloads/installs, creates Profile Owner instead of Device Owner |
| Android 13 | 🔄 Testing | Component name fix deployed (v0.0.8), awaiting test results |
| Android 16 Beta | ⏸️ Postponed | Beta instability, will test when stable |

### Known Limitations

1. **Android 10 Profile Owner Mode** - QR provisioning creates Work Profile instead of Device Owner
2. **Empty URLs in API routes** - Authenticated Convex client issue (workaround: manual QR generation)
3. **Gradle auto-signing** - Must manually sign with jarsigner after build

### Future Improvements

- [ ] Add QR validation before generation (fail fast on empty URLs)
- [ ] Investigate Android 10 Device Owner mode via additional QR parameters
- [ ] Automate APK signing in CI/CD pipeline
- [ ] Test Android 16 when stable release available
- [ ] Document policy enforcement and remote commands

---

**Document Version:** 1.0
**Contributors:** Engineering Team
**Last Review:** 2025-11-05
