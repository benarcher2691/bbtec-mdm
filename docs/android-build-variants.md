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
| **local** | `http://localhost:3000/api/client` | `com.bbtec.mdm.client.local` | `-local` | Local development on physical device |
| **staging** | `https://bbtec-mdm-git-development.vercel.app/api/client` | `com.bbtec.mdm.client.staging` | `-staging` | Testing against Vercel preview |
| **production** | `https://bbtec-mdm.vercel.app/api/client` | `com.bbtec.mdm.client` | (none) | Production deployment |

### Build Types

- **debug**: Unsigned, debuggable build (development/testing)
- **release**: Signed with keystore, optimized (production/staging distribution)

### Variants

Gradle combines **Flavors × BuildTypes** to create variants:
- `localDebug` - Local development, debuggable
- `localRelease` - Local development, signed (rarely used)
- `stagingDebug` - Staging, debuggable
- `stagingRelease` - Staging, signed for distribution
- `productionDebug` - Production, debuggable (rarely used)
- `productionRelease` - **Production, signed for MDM distribution**

## Build Commands

### Local Development (Physical Device Testing)

**Prerequisites:**
1. Connect Android device via USB
2. Enable USB debugging on device
3. Run `adb reverse tcp:3000 tcp:3000` to forward localhost

```bash
cd android-client

# Build local debug APK
./gradlew assembleLocalDebug

# Or build + install in one command
./gradlew installLocalDebug

# Verify installation
adb shell pm list packages | grep bbtec

# Expected output: com.bbtec.mdm.client.local
```

**APK Location:** `app/build/outputs/apk/local/debug/app-local-debug.apk`

**Testing Workflow:**
1. Start Next.js dev server: `npm run dev` (in project root)
2. Start Convex local backend: `npx convex dev --local` (in project root)
3. Forward port: `adb reverse tcp:3000 tcp:3000`
4. Install APK: `./gradlew installLocalDebug`
5. Test on physical device (app connects to laptop's localhost:3000)

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
            applicationIdSuffix = ".local"
            versionNameSuffix = "-local"
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
            buildConfigField("String", "BASE_URL", "\"https://bbtec-mdm.vercel.app/api/client\"")
        }
    }

    buildFeatures {
        buildConfig = true  // Enable BuildConfig generation
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
  public static final String APPLICATION_ID = "com.bbtec.mdm.client.local";
  public static final String VERSION_NAME = "0.0.38-local";
  public static final String BASE_URL = "http://localhost:3000/api/client";
}
```

**Production Release:**
```java
public final class BuildConfig {
  public static final String APPLICATION_ID = "com.bbtec.mdm.client";
  public static final String VERSION_NAME = "0.0.38";
  public static final String BASE_URL = "https://bbtec-mdm.vercel.app/api/client";
}
```

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

Because each flavor has a different Application ID, you can install all three simultaneously:

```bash
# Install all three flavors
./gradlew installLocalDebug
./gradlew installStagingRelease
./gradlew installProductionRelease

# Verify all installed
adb shell pm list packages | grep bbtec

# Output:
# com.bbtec.mdm.client.local
# com.bbtec.mdm.client.staging
# com.bbtec.mdm.client
```

**Use Case:**
- Compare behavior across environments
- Test production while developing locally
- QA testing with staging and production side-by-side

## Signing Configuration

Production and staging releases are signed with the keystore configured in `build.gradle.kts`:

```kotlin
signingConfigs {
    create("release") {
        storeFile = file("../bbtec-mdm.keystore")
        storePassword = "android"
        keyAlias = "bbtec-mdm"
        keyPassword = "android"
    }
}
```

**Verify Signing:**
```bash
jarsigner -verify -verbose -certs app/build/outputs/apk/production/release/app-production-release.apk
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

### Multiple Variants Conflict
**Problem:** Can't install staging after production installed.
**Solution:** This shouldn't happen if Application ID suffixes are configured correctly. Verify `applicationIdSuffix` is set for local/staging flavors.

## Version Management

### Bumping Version

Edit `android-client/app/build.gradle.kts`:

```kotlin
defaultConfig {
    versionCode = 39        // Increment for each release
    versionName = "0.0.39"  // Semantic version
}
```

**Version Naming:**
- Local: `0.0.39-local`
- Staging: `0.0.39-staging`
- Production: `0.0.39`

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
# LOCAL DEVELOPMENT
cd android-client
./gradlew installLocalDebug
adb reverse tcp:3000 tcp:3000

# STAGING TEST
cd android-client
./gradlew assembleStagingRelease
adb install -r app/build/outputs/apk/staging/release/app-staging-release.apk

# PRODUCTION BUILD
cd android-client
./gradlew assembleProductionRelease
# Upload: app/build/outputs/apk/production/release/app-production-release.apk

# CLEAN BUILD
cd android-client
./gradlew clean
./gradlew assembleProductionRelease

# CHECK WHAT'S INSTALLED
adb shell pm list packages | grep bbtec

# UNINSTALL VARIANTS
adb uninstall com.bbtec.mdm.client.local
adb uninstall com.bbtec.mdm.client.staging
adb uninstall com.bbtec.mdm.client
```

## Related Documentation

- [Multi-Environment Setup Plan](../planning/multi-environment-setup-plan.html) - Overall architecture
- [CLAUDE.md](../CLAUDE.md) - Project conventions and context
- [Android Client README](../android-client/README.md) - General Android client documentation

---

**Last Updated:** 2025-11-10
**Version:** 1.0
**Author:** Generated during multi-environment setup
