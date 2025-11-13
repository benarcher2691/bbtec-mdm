# Android Client Build Variants

## Overview

The BBTEC MDM Android client uses **Product Flavors** to support multiple environments with different server configurations. This allows you to:
- Develop and test locally against `localhost:3000`
- Test against staging deployments (Vercel preview)
- Build production releases for real devices

## Architecture

### Product Flavors (Environment Dimension)

| Flavor | Server URL | Application ID | Version Suffix | Use Case |
|--------|------------|----------------|----------------|----------|
| **local** | `http://<detected-lan-ip>:3000/api/client` | `com.bbtec.mdm.client` | `-local` | Local development (auto-detects LAN IP) |
| **staging** | `https://bbtec-mdm-git-development.vercel.app/api/client` | `com.bbtec.mdm.client.staging` | `-staging` | Testing against Vercel preview |
| **production** | `https://bbtec-mdm.vercel.app/api/client` | `com.bbtec.mdm.client` | (none) | Production deployment |

### Build Types

- **debug**: Signed with debug certificate (v1+v2), debuggable build (development/testing)
- **release**: Signed with production keystore (v1+v2), optimized (production/staging distribution)

**Important:** Both debug and release builds now use v1+v2 signing:
- **v1 (JAR signing)**: Creates META-INF/CERT.RSA for certificate extraction
- **v2 (APK Signature Scheme v2)**: Modern Android signing for faster verification

### Variants

Gradle combines **Flavors × BuildTypes** to create variants:
- `localDebug` - Local development, debuggable
- `localRelease` - Local development, signed (rarely used)
- `stagingDebug` - Staging, debuggable
- `stagingRelease` - Staging, signed for distribution
- `productionDebug` - Production, debuggable (rarely used)
- `productionRelease` - **Production, signed for MDM distribution**

## Offline-First Local Development

### Dynamic IP Detection

The web dashboard automatically detects your LAN IP address for local development, eliminating the need for hardcoded IPs or tunnels (ngrok/localtunnel).

**How it works:**
1. Next.js server detects if Convex URL contains "127.0.0.1" (local mode)
2. In local mode: Server scans `os.networkInterfaces()` to find your LAN IP (e.g., 192.168.1.13)
3. QR codes embed this detected IP instead of "localhost"
4. Android devices on the same LAN can reach your dev machine directly

**Key files:**
- `src/lib/network-detection.ts` - Shared detection utility
- `src/app/api/network-info/route.ts` - API endpoint for client-side detection
- `src/hooks/useServerUrl.ts` - React hook for components

**Benefits:**
- ✅ No internet required (true offline development)
- ✅ No tunnels needed (ngrok/localtunnel)
- ✅ IP changes handled automatically (DHCP reassignment)
- ✅ Environment-aware (local/cloud auto-detected)

### Environment-Aware APK Distribution

The system behaves differently based on whether you're running local or cloud Convex:

| Environment | APK Download Behavior | Why |
|-------------|----------------------|-----|
| **Local** (127.0.0.1:3210) | Next.js streams APK bytes to device | Localhost URLs unreachable from devices |
| **Cloud** (*.convex.cloud) | Redirects to Convex CDN URL | Efficient, no bandwidth through our server |

**Detection logic:** Checks if `downloadUrl` contains "127.0.0.1:3210" in `/api/apps/[storageId]/route.ts`

### Cleartext HTTP Support (Local Only)

Android 9+ blocks HTTP traffic by default. The local flavor includes a manifest override to allow HTTP connections:

**File:** `android-client/app/src/local/AndroidManifest.xml`
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- LOCAL FLAVOR ONLY: Allow cleartext (HTTP) traffic -->
    <application android:usesCleartextTraffic="true" />
</manifest>
```

**Security:** This configuration only applies to the local debug flavor. Staging and production use HTTPS exclusively.

### Local Development Workflow

```bash
# Terminal 1: Start Convex local backend
npx convex dev --local
# → Runs on http://127.0.0.1:3210 (offline database at ~/.convex/)

# Terminal 2: Start Next.js dev server
NEXT_PRIVATE_TURBOPACK=0 npm run dev
# → Auto-detects LAN IP (e.g., http://192.168.1.13:3000)
# → Check logs for: [NETWORK-DETECTION] Detected LAN IP

# Terminal 3: Build and test Android client
cd android-client
./gradlew clean assembleLocalDebug
# → APK: app/build/outputs/apk/local/debug/app-local-debug.apk

# Generate QR code in web dashboard
# → Scan QR with factory-reset Android device
# → Device downloads APK and enrolls (all offline!)
```

**Important Notes:**
- No `adb reverse` needed (devices connect via LAN IP)
- No USB cable required (works over WiFi)
- APK signature must match database (URL-safe Base64 without padding)
- Package name must match exactly (`com.bbtec.mdm.client`)

## Build Commands

### Local Development (Physical Device Testing)

**Two Testing Approaches:**

#### Option A: QR Code Enrollment (WiFi - Recommended)
No USB cable or adb reverse needed! Uses auto-detected LAN IP.

See "Testing Workflow (Offline-First)" section below.

#### Option B: Direct Install via USB (For Iterative Development)
When you want to quickly test code changes without going through enrollment:

**Prerequisites:**
1. Connect Android device via USB
2. Enable USB debugging on device
3. **REQUIRED:** Run `adb reverse tcp:3000 tcp:3000` to forward localhost

```bash
cd android-client

# Build and install in one command
./gradlew installLocalDebug

# Set up port forwarding (REQUIRED after any device disconnect/reconnect)
adb reverse tcp:3000 tcp:3000

# Verify installation
adb shell pm list packages | grep bbtec
# Expected output: com.bbtec.mdm.client (same as production - no .local suffix)
```

**Important:** Port forwarding must be re-run if you:
- Disconnect/reconnect USB cable
- Restart device
- Restart adb server

**APK Location:** `app/build/outputs/apk/local/debug/app-local-debug.apk`

**Testing Workflow (Offline-First):**
1. Start Convex local backend: `npx convex dev --local` (in project root)
2. Start Next.js dev server: `NEXT_PRIVATE_TURBOPACK=0 npm run dev` (in project root)
   - Watch logs for: `[NETWORK-DETECTION] Detected LAN IP: 192.168.x.x`
3. Build and upload APK in web dashboard (or use pre-built from artifacts/)
4. Generate enrollment QR code (includes auto-detected LAN IP)
5. Factory reset Android device and scan QR code
6. Device downloads APK and enrolls (all over LAN, no internet needed!)

**Note:** No `adb reverse` or USB cable required - devices connect over WiFi via detected LAN IP

### Staging Testing (Vercel Preview)

```bash
cd android-client

# Build staging release APK (signed)
./gradlew assembleStagingRelease

# Install manually
adb install -r app/build/outputs/apk/staging/release/app-staging-release.apk

# Verify installation
adb shell pm list packages | grep bbtec
# Expected output: com.bbtec.mdm.client.staging
```

**APK Location:** `app/build/outputs/apk/staging/release/app-staging-release.apk`

**Use Case:**
- Test against Vercel preview deployment (development branch)
- Connects to `kindly-mule-339` Convex dev deployment
- Can be installed alongside local and production variants

### Production Build (MDM Distribution)

```bash
cd android-client

# Build production release APK (signed, optimized)
./gradlew assembleProductionRelease

# Verify APK details
ls -lh app/build/outputs/apk/production/release/app-production-release.apk

# Check signing
jarsigner -verify -verbose -certs app/build/outputs/apk/production/release/app-production-release.apk
```

**APK Location:** `app/build/outputs/apk/production/release/app-production-release.apk`

**Distribution:**
1. Build production release APK
2. Test on physical device before distribution
3. Upload to Convex APK storage (or your MDM distribution system)
4. Deploy via QR code enrollment

---

## APK Signature Extraction

### Overview

Android device provisioning requires the APK signature checksum in URL-safe Base64 format. The system automatically extracts signatures when APKs are uploaded, but you can also extract them manually for verification or troubleshooting.

### Automatic Extraction (Recommended)

The system uses a **hybrid extraction approach** that works in all environments:

#### Local Development (with Android SDK):
1. APK is uploaded to Convex storage
2. Server-side API (`/api/apk/extract-signature`) downloads APK temporarily
3. Runs `apksigner verify --print-certs` to extract real signature
4. Runs `aapt dump badging` to extract package name and version
5. Converts SHA-256 to URL-safe Base64 (no padding, `+/` → `-_`)
6. Saves extracted metadata to database
7. ✅ **Dynamic extraction** - works with any APK you build

#### Cloud Deployment (Vercel - no Android SDK):
1. APK is uploaded to Convex storage
2. Server-side API tries to run apksigner
3. Tools not found → gracefully falls back to environment detection
4. Returns correct signature based on environment:
   - **Preview/Production:** `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE` (release keystore)
   - **Local/Unknown:** `iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk` (debug keystore)
5. ✅ **Environment-aware fallback** - works without Android SDK tools

**Key Insight:** Staging and production use the **same keystore**, so they have the **same signature**. Signatures don't change with version bumps (v0.0.39 → v0.0.40), only with keystore rotation.

**Implementation:** See `src/app/api/apk/extract-signature/route.ts`

### Manual Extraction (For Verification)

Use the helper script for manual extraction:

```bash
# Make script executable (if not already)
chmod +x scripts/extract-apk-signature.sh

# Extract signature from any APK
./scripts/extract-apk-signature.sh <path-to-apk>

# Example: Extract staging APK signature
./scripts/extract-apk-signature.sh android-client/app/build/outputs/apk/staging/release/app-staging-release.apk
```

**Output:**
```
✓ Extraction complete!

Package Name:      com.bbtec.mdm.client.staging
Version Name:      0.0.39-staging
Version Code:      39
Signature:         U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE
```

### Known Signatures

| Environment | Package Name | Signature (URL-safe Base64) |
|-------------|--------------|----------------------------|
| **Local** (debug) | `com.bbtec.mdm.client` | `iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk` |
| **Staging** | `com.bbtec.mdm.client.staging` | `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE` |
| **Production** | `com.bbtec.mdm.client` | _(To be documented)_ |

**Note:** Debug and production use the same package name but different keystores (different signatures).

### Signature Format

Android provisioning requires **URL-safe Base64 without padding** (RFC 4648):
- Replace `+` with `-`
- Replace `/` with `_`
- Remove trailing `=` padding

**Example Conversion:**
```
SHA-256 (hex):       53cd0e1a9e3f3a38c666842a9894ca8eb1eddcdcf4fb0e1310b3038fa71bce21
Standard Base64:     U80OGp4/OjjGZoQqmJTKjrHt3Nz0+w4TELMDj6cbziE=
URL-safe Base64:     U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE  ✅
```

### Troubleshooting

**Problem:** Signature mismatch during device provisioning

**Causes:**
1. APK built with wrong keystore (debug vs. production)
2. APK not uploaded to correct environment
3. Cached metadata in database

**Solution:**
1. Extract signature from actual APK being used:
   ```bash
   ./scripts/extract-apk-signature.sh path/to/your.apk
   ```
2. Verify signature matches what's in the database
3. If mismatch, re-upload APK (triggers automatic extraction)
4. Rebuild APK with correct keystore if needed

**Problem:** "Could not extract signature" error during upload

**Causes:**
1. APK not properly signed
2. apksigner or aapt not found on server
3. Corrupt APK file

**Solution:**
1. Verify APK is signed:
   ```bash
   /opt/android-sdk/build-tools/34.0.0/apksigner verify app.apk
   ```
2. Rebuild APK if necessary
3. Check server logs for detailed error message

---

## Gradle Tasks Reference

### List All Build Tasks
```bash
./gradlew tasks --group="build"
```

### Assemble Tasks
```bash
./gradlew assembleLocalDebug          # Local debug APK
./gradlew assembleLocalRelease        # Local release APK (signed)
./gradlew assembleStagingDebug        # Staging debug APK
./gradlew assembleStagingRelease      # Staging release APK (signed)
./gradlew assembleProductionDebug     # Production debug APK
./gradlew assembleProductionRelease   # Production release APK (signed)
```

### Install Tasks (requires connected device)
```bash
./gradlew installLocalDebug           # Install local debug variant
./gradlew installStagingRelease       # Install staging release variant
./gradlew installProductionRelease    # Install production release variant
```

### Clean Build
```bash
./gradlew clean                       # Clean all build outputs
./gradlew clean assembleLocalDebug    # Clean + build specific variant
```

### Compile Check (faster than full build)
```bash
./gradlew compileLocalDebugKotlin     # Type-check without building APK
```

## Configuration Details

### build.gradle.kts Configuration

The build variants are configured in `android-client/app/build.gradle.kts`:

```kotlin
android {
    // ... other config

    // Product Flavors for different environments
    flavorDimensions += "environment"
    productFlavors {
        create("local") {
            dimension = "environment"
            // Note: No applicationIdSuffix for local - keeps base package name
            // This means you can't install local + production at the same time
            versionNameSuffix = "-local"
            // localhost works with dynamic IP detection (server auto-detects LAN IP)
            buildConfigField("String", "BASE_URL", "\"http://localhost:3000/api/client\"")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            buildConfigField("String", "BASE_URL", "\"https://bbtec-mdm-git-development.vercel.app/api/client\"")
        }
        create("production") {
            dimension = "environment"
            // Production keeps the original applicationId (no suffix)
            buildConfigField("String", "BASE_URL", "\"https://bbtec-mdm.vercel.app/api/client\"")
        }
    }

    signingConfigs {
        getByName("debug") {
            // Enable both v1 (JAR) and v2 signing for compatibility
            // v1 is needed for parsing code that looks for META-INF/ certificates
            enableV1Signing = true
            enableV2Signing = true
        }
        create("release") {
            storeFile = file("../bbtec-mdm.keystore")
            storePassword = "android"
            keyAlias = "bbtec-mdm"
            keyPassword = "android"
            enableV1Signing = true
            enableV2Signing = true
        }
    }

    buildFeatures {
        buildConfig = true  // Enable BuildConfig generation for flavor-specific constants
    }
}
```

### ApiClient.kt Integration

The server URL is accessed via `BuildConfig.BASE_URL`:

```kotlin
class ApiClient(private val context: Context) {
    // Server URL from build configuration (varies by flavor)
    private val baseUrl = BuildConfig.BASE_URL

    // ... rest of ApiClient code
}
```

### Generated BuildConfig

During build, Gradle generates `BuildConfig.java` for each variant:

**Local Debug:**
```java
public final class BuildConfig {
  public static final String APPLICATION_ID = "com.bbtec.mdm.client";
  public static final String VERSION_NAME = "0.0.39-local";
  public static final String BASE_URL = "http://localhost:3000/api/client";
  public static final boolean DEBUG = true;
}
```

**Production Release:**
```java
public final class BuildConfig {
  public static final String APPLICATION_ID = "com.bbtec.mdm.client";
  public static final String VERSION_NAME = "0.0.39";
  public static final String BASE_URL = "https://bbtec-mdm.vercel.app/api/client";
  public static final boolean DEBUG = false;
}
```

**Note:** Local and production now share the same APPLICATION_ID. This means:
- ✅ Provisioning QR codes work identically (no package name mismatch)
- ⚠️ Cannot install local + production simultaneously (package conflict)
- ✅ Install staging alongside local/production (staging has `.staging` suffix)

## Testing on Physical Device

### Why Physical Device Instead of Emulator?
- Lower resource usage (important for Lenovo T480s)
- Real-world testing conditions
- Faster iteration cycle
- No emulator performance overhead

### Setup Physical Device

1. **Enable Developer Options:**
   - Go to Settings → About phone
   - Tap "Build number" 7 times
   - Developer options now available in Settings

2. **Enable USB Debugging:**
   - Settings → Developer options
   - Enable "USB debugging"

3. **Connect Device:**
   ```bash
   # Connect via USB cable
   adb devices

   # Expected output:
   # List of devices attached
   # ABC123XYZ    device
   ```

4. **Forward Localhost Port:**
   ```bash
   # Critical step for local development!
   adb reverse tcp:3000 tcp:3000

   # Now device can access localhost:3000 as if it's its own localhost
   ```

5. **Install and Test:**
   ```bash
   cd android-client
   ./gradlew installLocalDebug

   # Launch app on device and test
   ```

### Testing Workflow

```bash
# Terminal 1: Start Convex local backend
npx convex dev --local
# → Runs on http://127.0.0.1:3210

# Terminal 2: Start Next.js dev server
npm run dev
# → Runs on http://localhost:3000

# Terminal 3: Install Android client
cd android-client
adb reverse tcp:3000 tcp:3000
./gradlew installLocalDebug

# Open app on device - it will connect to localhost:3000!
```

## Multiple Variants on Same Device

**Important:** Local and production variants now share the same package name (`com.bbtec.mdm.client`), so they **cannot** be installed simultaneously.

**What you can install together:**
- ✅ Local + Staging (different package names)
- ✅ Production + Staging (different package names)
- ❌ Local + Production (same package name - will conflict)

```bash
# Install local debug + staging
./gradlew installLocalDebug
./gradlew installStagingRelease

# Verify installed
adb shell pm list packages | grep bbtec

# Expected output:
# com.bbtec.mdm.client         (local debug)
# com.bbtec.mdm.client.staging (staging release)
```

**Why this change?**
Android provisioning requires the APK package name to match exactly what's in the QR code. By removing the `.local` suffix, we ensure:
- ✅ Same QR code format for local and production testing
- ✅ No "Can't set up device" errors from package mismatch
- ✅ Consistent provisioning flow across environments

**Use Case:**
- Test staging while developing locally
- Compare staging vs local behavior
- QA can test staging alongside local development builds

## Signing Configuration

All builds (debug and release) use **v1 + v2 signing** for maximum compatibility:

### ⚠️  Keystore Security Status

**CRITICAL:** This project has two keystores:

| Keystore | Status | Use Case |
|----------|--------|----------|
| `bbtec-mdm.keystore` | ⚠️  **COMPROMISED** | Development/testing only |
| `bbtec-mdm-PRODUCTION.keystore` | ✅ **SECURE** | Production releases only |

**Development Keystore Compromise:**
- Password was accidentally exposed in git commit `ae3d684` (2025-11-12)
- Signed APKs were committed to git history
- **Safe for local development and testing only**
- **DO NOT use for production releases or public distribution**

**Full details:** See `../android-client/SECURITY-NOTICE.md`

### Secure Keystore Management

**IMPORTANT:** Keystore credentials are stored securely outside of version control.

**Setup (one-time per developer):**
```bash
cd android-client

# For development/testing:
cp keystore.properties.example keystore.properties
# Get credentials from password manager (GNU pass)

# For production releases:
# Contact team lead for production keystore access
```

**File structure:**
```
android-client/
├── keystore.properties              # Dev credentials (gitignored!)
├── keystore.properties.example      # Template (in git)
├── bbtec-mdm.keystore              # Dev keystore (COMPROMISED)
├── bbtec-mdm-PRODUCTION.keystore   # Production keystore (SECURE, gitignored!)
├── SECURITY-NOTICE.md              # Compromise documentation
└── PRODUCTION-KEYSTORE-BACKUP.md   # Production backup guide
```

**Configuration (build.gradle.kts):**
```kotlin
// Loads credentials from keystore.properties (local file, not in git)
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

signingConfigs {
    getByName("debug") {
        // Debug builds: v1+v2 signing for certificate extraction
        enableV1Signing = true  // Creates META-INF/CERT.RSA
        enableV2Signing = true  // Modern APK signing
    }
    create("release") {
        // Load credentials from keystore.properties (not hardcoded!)
        storeFile = file(keystoreProperties.getProperty("storeFile") ?: "../bbtec-mdm.keystore")
        storePassword = keystoreProperties.getProperty("storePassword")
            ?: System.getenv("KEYSTORE_PASSWORD")
        keyAlias = keystoreProperties.getProperty("keyAlias")
            ?: System.getenv("KEY_ALIAS")
        keyPassword = keystoreProperties.getProperty("keyPassword")
            ?: System.getenv("KEY_PASSWORD")
        enableV1Signing = true
        enableV2Signing = true
    }
}
```

**Security benefits:**
- ✅ Credentials never committed to git
- ✅ Each developer uses their own local file
- ✅ CI/CD can use environment variables as fallback
- ✅ No risk of accidental password exposure

**Why v1 + v2 Signing?**
- **v1 (JAR signing)**: Creates `META-INF/CERT.RSA` file needed for certificate extraction in web dashboard
- **v2 (APK Signature Scheme v2)**: Modern Android signing with faster verification
- **Compatibility**: v1 ensures older APK parsing code can extract certificates

**Verify Signing:**
```bash
# Check signing schemes
/opt/android-sdk/build-tools/34.0.0/apksigner verify --verbose app/build/outputs/apk/local/debug/app-local-debug.apk

# Expected output:
# Verified using v1 scheme (JAR signing): true
# Verified using v2 scheme (APK Signature Scheme v2): true

# Extract certificate (v1 method)
unzip -l app/build/outputs/apk/local/debug/app-local-debug.apk | grep META-INF
# Should show: META-INF/CERT.RSA, META-INF/CERT.SF, META-INF/MANIFEST.MF
```

## Troubleshooting

### "ProductFlavor names cannot collide with BuildType names"
**Problem:** Named a flavor `debug`, which conflicts with the default `debug` BuildType.
**Solution:** Rename flavor (we use `local` instead).

### "Cannot access BuildConfig.BASE_URL"
**Problem:** `buildConfig = true` not enabled in `build.gradle.kts`.
**Solution:** Add `buildFeatures { buildConfig = true }` to android block.

### Device Can't Connect to Localhost
**Problem:** Physical device can't reach `localhost:3000`.
**Solution:** Run `adb reverse tcp:3000 tcp:3000` before testing.

### APK Not Signed
**Problem:** Release APK not signed with keystore.
**Solution:** Verify keystore exists at `android-client/bbtec-mdm.keystore` and signing config is correct.

### "Missing keystore password" Error
**Problem:** Build fails with error: "Missing keystore password - create keystore.properties or set KEYSTORE_PASSWORD env var"
**Cause:** The `keystore.properties` file is missing (it's gitignored for security).
**Solution:**
```bash
cd android-client
cp keystore.properties.example keystore.properties
# Get credentials from password manager (GNU pass) or team lead
# See SECURITY-NOTICE.md for keystore details
```

### Can't Install Local After Production (or vice versa)
**Problem:** Installing local debug fails with "INSTALL_FAILED_ALREADY_EXISTS" after production installed.
**Solution:** Local and production share the same package name (`com.bbtec.mdm.client`). Uninstall one before installing the other:
```bash
adb uninstall com.bbtec.mdm.client
./gradlew installLocalDebug
```

### "Can't Set Up Device" During Provisioning
**Problem:** Device shows "Can't set up device" immediately after scanning QR code.
**Root Causes:**
1. **Package name mismatch**: QR code says `com.bbtec.mdm.client`, APK has `com.bbtec.mdm.client.local`
2. **Signature mismatch**: Database has wrong APK signature checksum

**Solution:**
- Verify package name matches: `unzip -p app/build/outputs/apk/local/debug/app-local-debug.apk AndroidManifest.xml | strings | grep package`
- Extract actual signature: `/opt/android-sdk/build-tools/34.0.0/apksigner verify --print-certs app-local-debug.apk`
- Update `src/lib/apk-signature-client.ts` with URL-safe Base64 signature (no padding, `+/` → `-_`)

### APK Signature Format Wrong
**Problem:** Provisioning fails with checksum error.
**Solution:** Android provisioning requires **URL-safe Base64 without padding** (RFC 4648):
- ❌ Wrong: `iFlIwQLMpbKE/1YZ5L+UHXMSmeKsHCwvJRsm7kgkblk=` (has `=`, `/`, `+`)
- ✅ Correct: `iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk` (no `=`, uses `-` and `_`)

### Dynamic IP Not Detected
**Problem:** QR code shows wrong IP or no IP detected.
**Solution:**
- Check Next.js logs for `[NETWORK-DETECTION]` output
- Verify `NEXT_PUBLIC_CONVEX_URL` contains "127.0.0.1" for local mode
- Ensure your machine has a LAN interface (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Restart Next.js server if IP changed (DHCP reassignment)

### APK Download Fails (404 or Network Error)
**Problem:** Device can't download APK during provisioning.
**Local Mode:**
- Verify Next.js server is running and accessible on LAN
- Check device is on same WiFi network as dev machine
- Test connectivity: `curl http://<detected-ip>:3000/api/network-info` from another device

**Cloud Mode:**
- Verify APK uploaded to Convex storage
- Check Convex dashboard for storage URL

## Version Management

### Bumping Version

Edit `android-client/app/build.gradle.kts`:

```kotlin
defaultConfig {
    versionCode = 39        // Increment for each release (Play Store requires this)
    versionName = "0.0.39"  // Semantic version (user-visible)
}
```

**Version Naming Convention:**
- Local: `0.0.39-local` (auto-appended by versionNameSuffix)
- Staging: `0.0.39-staging` (auto-appended by versionNameSuffix)
- Production: `0.0.39` (no suffix)

**Best Practice:**
- Always bump version after significant changes
- `versionCode` must increment (Android requirement)
- `versionName` follows semantic versioning: `MAJOR.MINOR.PATCH`
- Tag releases with git: `git tag android-v0.0.41 -m "Android client v0.0.41"`
- Current version: **0.0.41** (as of 2025-11-12)

## Build Provenance & Traceability

**Critical for production debugging:** Every APK now includes git metadata so you can trace any build back to its exact source code.

### What's Injected Into Every APK

The build system automatically injects the following into `BuildConfig`:

```kotlin
// Automatically generated in every build
public static final String GIT_COMMIT_SHA = "7ba03a0";     // Git commit (short SHA)
public static final String GIT_BRANCH = "feature/my-feature";  // Git branch name
public static final String BUILD_TIMESTAMP = "2025-11-12T21:32:38Z";  // ISO 8601 timestamp
```

### How It Works

In `android-client/app/build.gradle.kts`:

```kotlin
// Git metadata functions (automatically executed during build)
fun getGitCommitSha(): String {
    val stdout = ByteArrayOutputStream()
    exec {
        commandLine("git", "rev-parse", "--short", "HEAD")
        standardOutput = stdout
    }
    return stdout.toString().trim()
}

fun getGitBranch(): String {
    val stdout = ByteArrayOutputStream()
    exec {
        commandLine("git", "rev-parse", "--abbrev-ref", "HEAD")
        standardOutput = stdout
    }
    return stdout.toString().trim()
}

fun getBuildTimestamp(): String {
    return Instant.now().toString()
}

// Inject into BuildConfig
android {
    defaultConfig {
        // ... version info
        buildConfigField("String", "GIT_COMMIT_SHA", "\"${getGitCommitSha()}\"")
        buildConfigField("String", "GIT_BRANCH", "\"${getGitBranch()}\"")
        buildConfigField("String", "BUILD_TIMESTAMP", "\"${getBuildTimestamp()}\"")
    }
}
```

### Using Build Info in Your Android App

**Create a BuildInfo helper (recommended):**

```kotlin
// File: app/src/main/java/com/bbtec/mdm/client/BuildInfo.kt
package com.bbtec.mdm.client

object BuildInfo {
    val version: String = BuildConfig.VERSION_NAME
    val versionCode: Int = BuildConfig.VERSION_CODE
    val gitCommit: String = BuildConfig.GIT_COMMIT_SHA
    val gitBranch: String = BuildConfig.GIT_BRANCH
    val buildTime: String = BuildConfig.BUILD_TIMESTAMP

    fun getFullInfo(): String {
        return """
            BBTec MDM Client
            Version: $version ($versionCode)
            Commit: $gitCommit
            Branch: $gitBranch
            Built: $buildTime
        """.trimIndent()
    }
}
```

**Use in your app:**

```kotlin
// In MainActivity or any Activity:
import android.util.Log
import com.bbtec.mdm.client.BuildInfo

// Log on app startup
Log.i("AppInfo", BuildInfo.getFullInfo())

// Display in an "About" screen
aboutTextView.text = BuildInfo.getFullInfo()

// Send with bug reports
val bugReport = """
    User reported issue: ...
    ${BuildInfo.getFullInfo()}
""".trimIndent()
```

### Reproducible Builds

**Scenario:** User reports a bug in production APK v0.0.41

**Before build provenance:**
```
You: "Which code was that built from?" 🤷
Team: *checks git history, guesses based on dates*
```

**After build provenance:**
```
1. Check app logs or About screen: "Commit: 7ba03a0"
2. Checkout that exact commit:
   git checkout 7ba03a0
3. Rebuild:
   cd android-client
   ./gradlew assembleProductionRelease
4. → Produces identical APK (minus timestamp)
5. Debug the exact code that's running in production ✅
```

### Git Tagging Workflow (Recommended)

**When releasing a new version:**

```bash
# 1. Bump version in build.gradle.kts
vim android-client/app/build.gradle.kts
# Set: versionCode = 42, versionName = "0.0.42"

# 2. Commit version bump
git add android-client/app/build.gradle.kts
git commit -m "chore: Bump Android client to v0.0.42"

# 3. Tag the release
git tag -a android-v0.0.42 -m "Android client v0.0.42

- Feature X added
- Bug Y fixed
"

# 4. Build release APK
cd android-client
./gradlew clean assembleProductionRelease

# 5. Copy APK to artifacts with git SHA in filename (optional)
cp app/build/outputs/apk/production/release/app-production-release.apk \
   ../artifacts/apks/production/app-production-release-0.0.42-$(git rev-parse --short HEAD).apk

# 6. Push with tags
git push origin feature/your-branch
git push origin android-v0.0.42
```

**To rebuild a specific version:**

```bash
# List all Android release tags
git tag -l "android-v*"

# Checkout a specific version
git checkout android-v0.0.42

# Rebuild (produces same APK)
cd android-client
./gradlew clean assembleProductionRelease
```

### Benefits

| Scenario | Before | After |
|----------|--------|-------|
| **Production bug** | Can't find exact source code | `git checkout <SHA>` → debug |
| **Reproduce build** | Guesswork based on dates | Exact commit SHA → rebuild |
| **Support inquiry** | "What version are you on?" | Check logs: commit + timestamp |
| **Release tracking** | Manual spreadsheet | Git tags + BuildConfig |
| **Team onboarding** | No history of what was released | Git tags show all releases |

### Viewing Build Info

**From APK file (without running the app):**

```bash
# Extract BuildConfig.java from APK
unzip -p app-production-release.apk "*/BuildConfig.class" | strings | grep -E "GIT_|BUILD_"

# Or decompile APK and read BuildConfig
```

**From running app:**

```bash
# View logs if app logs build info on startup
adb logcat | grep "AppInfo"

# Or use Android Studio's App Inspection to read BuildConfig values
```

### Troubleshooting

**Problem:** `GIT_COMMIT_SHA` shows "unknown"

**Causes:**
1. Building outside of a git repository
2. Git not installed on build machine
3. Shallow git clone (CI/CD)

**Solution:**
```bash
# Verify git is accessible during build
git rev-parse --short HEAD

# For CI/CD, ensure full checkout (not shallow)
# GitHub Actions example:
- uses: actions/checkout@v3
  with:
    fetch-depth: 0  # Full history, not shallow
```

**Problem:** Builds are not reproducible (different checksums)

**Cause:** `BUILD_TIMESTAMP` changes with every build

**Solution:**
- Accept that timestamps will differ
- Compare APKs by git commit SHA, not file hash
- Or remove timestamp from BuildConfig if bit-for-bit reproducibility is required

## CI/CD Integration (Future)

Future enhancements for automated builds:

```yaml
# .github/workflows/android-build.yml (future)
name: Build Android APKs

on:
  push:
    branches: [development, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
      - name: Build Production Release
        run: |
          cd android-client
          ./gradlew assembleProductionRelease
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: app-production-release
          path: android-client/app/build/outputs/apk/production/release/app-production-release.apk
```

## Quick Reference Card

```bash
# OFFLINE LOCAL DEVELOPMENT (Recommended)
# Terminal 1: Start Convex local backend
npx convex dev --local

# Terminal 2: Start Next.js (auto-detects LAN IP)
NEXT_PRIVATE_TURBOPACK=0 npm run dev
# → Watch for: [NETWORK-DETECTION] Detected LAN IP: 192.168.x.x

# Terminal 3: Build APK
cd android-client
./gradlew clean assembleLocalDebug
# → Upload APK in web dashboard
# → Generate QR code (includes detected LAN IP)
# → Scan with factory-reset device (all offline!)

# STAGING TEST
cd android-client
./gradlew assembleStagingRelease
adb install -r app/build/outputs/apk/staging/release/app-staging-release.apk

# PRODUCTION BUILD
cd android-client
./gradlew clean assembleProductionRelease
# Upload: app/build/outputs/apk/production/release/app-production-release.apk

# CHECK WHAT'S INSTALLED
adb shell pm list packages | grep bbtec
# Expected:
# com.bbtec.mdm.client         (local OR production, not both)
# com.bbtec.mdm.client.staging (if installed)

# UNINSTALL VARIANTS
adb uninstall com.bbtec.mdm.client          # Removes local OR production
adb uninstall com.bbtec.mdm.client.staging  # Removes staging

# VERIFY APK SIGNING (v1+v2)
/opt/android-sdk/build-tools/34.0.0/apksigner verify --verbose \
  app/build/outputs/apk/local/debug/app-local-debug.apk

# EXTRACT APK SIGNATURE (for database)
/opt/android-sdk/build-tools/34.0.0/apksigner verify --print-certs \
  app-local-debug.apk | grep SHA-256 | head -1 | awk '{print $2}'
# Convert to URL-safe Base64 (remove =, +/→-_)
```

## Related Documentation

- [Multi-Environment Setup Plan](../planning/multi-environment-setup-plan.html) - Overall architecture
- [CLAUDE.md](../CLAUDE.md) - Project conventions and context
- [Android Client README](../android-client/README.md) - General Android client documentation

---

**Last Updated:** 2025-11-12
**Version:** 3.0 (Build Provenance & Security Update)
**Android Client Version:** 0.0.41
**Changes:**
- **Build Provenance**: Git commit SHA, branch, and timestamp injected into every APK
- **Secure Keystore**: Credentials moved to gitignored `keystore.properties` file
- Reproducible builds via git commit traceability
- Git tagging workflow for release management
- Dynamic IP detection for local development
- Environment-aware APK streaming (local streams, cloud redirects)
- Cleartext HTTP support for local flavor
- v1+v2 signing for both debug and release builds
- Removed `.local` package suffix (local and production share base package name)
- Comprehensive troubleshooting for provisioning issues
