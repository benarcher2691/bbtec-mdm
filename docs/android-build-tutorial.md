# Android APK Build Tutorial

## Overview

This step-by-step tutorial walks you through building an Android APK from scratch, including version bumping and verification. Perfect for new team members or as a refresher for experienced developers.

**What you'll learn:**
- How to check and bump version numbers
- How to build local debug APKs
- How to verify build provenance (git metadata)
- How to verify APK signing and metadata
- How to archive APKs for long-term storage
- Git workflow for version tagging

**Prerequisites:**
- Android SDK installed at `/opt/android-sdk/`
- Git repository cloned
- `keystore.properties` file configured (see `android-build-variants.md`)

**Time required:** ~5 minutes

---

## ⚠️  Security Notice

**IMPORTANT:** This project has two keystores with different security statuses:

| Keystore | Status | Use Case |
|----------|--------|----------|
| `bbtec-mdm.keystore` | ⚠️  COMPROMISED | Development/testing only |
| `bbtec-mdm-PRODUCTION.keystore` | ✅ SECURE | Production releases only |

**For development/testing builds:** This tutorial uses the development keystore, which is safe for local testing.

**For production releases:** Use the production keystore - see `../android-client/PRODUCTION-KEYSTORE-BACKUP.md`

**Full security details:** See `../android-client/SECURITY-NOTICE.md`

---

## Step-by-Step Walkthrough

### **Step 1: Check Current Version**

First, navigate to the Android client directory and check the current version:

```bash
cd /home/ben/sandbox/bbtec-mdm/android-client
grep -A2 "versionCode\|versionName" app/build.gradle.kts | grep -E "versionCode|versionName"
```

**Expected output:**
```
versionCode = 42
versionName = "0.0.42"
versionNameSuffix = "-local"
versionNameSuffix = "-staging"
```

**What you're seeing:**
- `versionCode = 42` - Internal Android version number (must increment)
- `versionName = "0.0.42"` - User-visible version string
- `versionNameSuffix` - Automatic suffixes added by flavors (ignore these)

**Note:** The suffix lines are normal - they show flavor-specific suffixes that get appended automatically (`-local`, `-staging`).

---

### **Step 2: Decide on Version (Bump if Needed)**

From Step 1, you saw the version in `build.gradle.kts` (e.g., version 43).

**This is the version that will be built into your next APK.**

**💡 Check what's been previously released:**
```bash
git tag -l "android-v*" | sort -V | tail -5
```

**Example output:**
```
android-v0.0.42
```

**Now decide:**
- Latest tag is `android-v0.0.42`, build.gradle.kts shows `43` → **Version 43 is NEW**
- You want to build version 43 → **Skip to Step 3** (no bumping needed)
- You want to build version 44 instead → **Bump it below**

---

**To manually bump the version (example: 43 → 44):**

```bash
sed -i 's/versionCode = 43/versionCode = 44/' app/build.gradle.kts
sed -i 's/versionName = "0.0.43"/versionName = "0.0.44"/' app/build.gradle.kts
```

**Verify the change:**
```bash
grep -A2 "versionCode\|versionName" app/build.gradle.kts | grep -E "versionCode|versionName"
```

**Expected output:**
```
versionCode = 44
versionName = "0.0.44"
versionNameSuffix = "-local"
versionNameSuffix = "-staging"
```

✅ **Key check:** First two lines should show the version you want to build

**💡 Important notes:**
- **Versions are NEVER automatically bumped** - you must change them manually
- `versionCode` - Must increment with every release (Google Play requirement)
- `versionName` - Semantic versioning: `MAJOR.MINOR.PATCH` (e.g., 0.0.44)
- All three flavors (local, staging, production) share the same base version
- **The version in build.gradle.kts IS what will be built into your APK**

---

### **Step 3: Clean Build**

Remove old build artifacts to ensure a fresh build:

```bash
./gradlew clean
```

**Expected output:**
```
BUILD SUCCESSFUL in 5s
1 actionable task: 1 executed
```

**What this does:**
- Deletes the `app/build/` directory
- Ensures no stale artifacts affect the new build
- Takes ~5-10 seconds

**Troubleshooting:**
- **Error: "Permission denied"** - Make sure `gradlew` is executable: `chmod +x gradlew`
- **Error: "JAVA_HOME not set"** - Set Java environment: `export JAVA_HOME=/usr/lib/jvm/java-17-openjdk`

---

### **Step 4: Build APK (Choose Your Environment)**

The project supports three build environments. Choose the one you need:

#### **Option A: Local Development (Debug Build)**

**When to use:** Testing on physical device connected via USB with `adb reverse` port forwarding.

```bash
./gradlew assembleLocalDebug
```

**Output location:**
```
app/build/outputs/apk/local/debug/app-local-debug.apk
```

**Configuration:**
- Package: `com.bbtec.mdm.client` (base package)
- Server: `http://localhost:3000/api/client` (requires `adb reverse tcp:3000 tcp:3000`)
- Keystore: Debug keystore (unsigned for development)
- Can coexist with: Staging APK (different package name)

---

#### **Option B: Staging (Release Build)**

**When to use:** Testing against Vercel preview deployment (development branch on cloud).

```bash
./gradlew assembleStagingRelease
```

**Output location:**
```
app/build/outputs/apk/staging/release/app-staging-release.apk
```

**Configuration:**
- Package: `com.bbtec.mdm.client.staging` (staging suffix)
- Server: `https://bbtec-mdm-git-development.vercel.app/api/client`
- Keystore: Release keystore (`bbtec-mdm.keystore` - requires `keystore.properties`)
- Can coexist with: Local and Production APKs (different package names)

---

#### **Option C: Production (Release Build)**

**When to use:** Building final APK for production deployment or real device provisioning.

```bash
./gradlew assembleProductionRelease
```

**Output location:**
```
app/build/outputs/apk/production/release/app-production-release.apk
```

**Configuration:**
- Package: `com.bbtec.mdm.client` (base package)
- Server: `https://bbtec-mdm.vercel.app/api/client`
- Keystore: Release keystore (`bbtec-mdm.keystore` - requires `keystore.properties`)
- **CANNOT** coexist with: Local APK (same package name)

---

#### **Build Output**

**Expected output (at the end of any build):**
```
BUILD SUCCESSFUL in 25s
45 actionable tasks: 45 executed
```

**What every build does:**
- Compiles Kotlin source code
- Injects git metadata (commit SHA, branch, timestamp) via `BuildConfig`
- Packages everything into an APK
- Signs with appropriate keystore (debug or release)
- Takes ~20-40 seconds (first build after clean)

**Expected warnings (IGNORE THESE - they're harmless):**
```
w: file:///.../ApiClient.kt:72:13: Variable 'requestStartElapsed' is never used
w: file:///.../DeviceRegistration.kt:108:13: Variable 'adminComponent' is never used
```

These are Kotlin compiler warnings about unused variables in your code - they don't affect the build.

**Troubleshooting:**
- **Error: "Missing keystore password"** (staging/production only) - You need `keystore.properties` file. See troubleshooting section below.
- **Build hangs** - First build downloads dependencies; may take 2-3 minutes
- **Out of memory** - Increase Gradle memory in `gradle.properties`

---

### **Step 5: Verify APK Was Created**

Check that the APK file exists and note its size (adjust path based on which environment you built):

**For Local Debug:**
```bash
ls -lh app/build/outputs/apk/local/debug/
```

**For Staging Release:**
```bash
ls -lh app/build/outputs/apk/staging/release/
```

**For Production Release:**
```bash
ls -lh app/build/outputs/apk/production/release/
```

**Expected output (example for Local Debug):**
```
Permissions Size User Date Modified Name
.rw-r--r--   15M ben  12 Nov 21:51   app-local-debug.apk
.rw-r--r--   391 ben  12 Nov 21:51   output-metadata.json
```

✅ **Success indicators:**
- APK file exists with correct naming:
  - Local: `app-local-debug.apk`
  - Staging: `app-staging-release.apk`
  - Production: `app-production-release.apk`
- Size is ~10-15 MB (debug APKs are slightly larger than release)
- Timestamp shows recent build time

---

### **Step 6: Check Build Provenance (The Magic!)**

This is where we verify that git metadata was injected into the APK.

**For Local Debug:**
```bash
cat app/build/generated/source/buildConfig/local/debug/com/bbtec/mdm/client/BuildConfig.java | grep -E "VERSION|GIT_|BUILD_"
```

**For Staging Release:**
```bash
cat app/build/generated/source/buildConfig/staging/release/com/bbtec/mdm/client/BuildConfig.java | grep -E "VERSION|GIT_|BUILD_"
```

**For Production Release:**
```bash
cat app/build/generated/source/buildConfig/production/release/com/bbtec/mdm/client/BuildConfig.java | grep -E "VERSION|GIT_|BUILD_"
```

**Expected output (example for Local Debug):**
```java
public static final String BUILD_TYPE = "debug";
public static final int VERSION_CODE = 43;
public static final String VERSION_NAME = "0.0.43-local";
public static final String BUILD_TIMESTAMP = "2025-11-12T21:45:33.481967820Z";
public static final String GIT_BRANCH = "feature/offline-local-dev";
public static final String GIT_COMMIT_SHA = "47e035b";
```

**Note:** VERSION_NAME suffix changes per environment:
- Local: `"0.0.43-local"`
- Staging: `"0.0.43-staging"`
- Production: `"0.0.43"` (no suffix)

🎉 **This is build provenance in action!**

**What you're seeing:**
- `VERSION_CODE = 43` - Your version number ✅
- `VERSION_NAME` - Version with environment-specific suffix ✅
- `GIT_COMMIT_SHA = "47e035b"` - The exact git commit this APK was built from ✅
- `GIT_BRANCH = "feature/..."` - The branch name ✅
- `BUILD_TIMESTAMP` - Exact build time (ISO 8601 format) ✅

**Why this matters:**
- You can trace any production APK back to its exact source code
- Reproducible builds: `git checkout 47e035b` → rebuild → same APK
- Debug production issues: check logs for commit SHA → checkout → investigate

---

### **Step 7: Verify APK Package Metadata**

Extract and verify the APK's Android metadata using `aapt`.

**For Local Debug:**
```bash
/opt/android-sdk/build-tools/34.0.0/aapt dump badging app/build/outputs/apk/local/debug/app-local-debug.apk | grep -E "package:|versionCode|versionName"
```

**For Staging Release:**
```bash
/opt/android-sdk/build-tools/34.0.0/aapt dump badging app/build/outputs/apk/staging/release/app-staging-release.apk | grep -E "package:|versionCode|versionName"
```

**For Production Release:**
```bash
/opt/android-sdk/build-tools/34.0.0/aapt dump badging app/build/outputs/apk/production/release/app-production-release.apk | grep -E "package:|versionCode|versionName"
```

**Expected output (example for Local Debug):**
```
package: name='com.bbtec.mdm.client' versionCode='43' versionName='0.0.43-local' platformBuildVersionName='14' platformBuildVersionCode='34' compileSdkVersion='34' compileSdkVersionCodename='14'
```

**Expected package names per environment:**
- Local: `com.bbtec.mdm.client` (base package)
- Staging: `com.bbtec.mdm.client.staging` (with `.staging` suffix)
- Production: `com.bbtec.mdm.client` (base package)

✅ **Verify these values:**
- `name=` - Package name matches environment ✅
- `versionCode='43'` - Matches what you set ✅
- `versionName='0.0.43-...'` - Matches with environment suffix ✅
- `compileSdkVersion='34'` - Android 14 (API level 34) ✅

**What this verifies:**
- APK metadata is correct
- Android will recognize the version
- Package name matches the environment

---

### **Step 8: Verify APK Signing**

Check that the APK is properly signed.

**For Local Debug:**
```bash
/opt/android-sdk/build-tools/34.0.0/apksigner verify --verbose app/build/outputs/apk/local/debug/app-local-debug.apk | grep "Verified using"
```

**For Staging Release:**
```bash
/opt/android-sdk/build-tools/34.0.0/apksigner verify --verbose app/build/outputs/apk/staging/release/app-staging-release.apk | grep "Verified using"
```

**For Production Release:**
```bash
/opt/android-sdk/build-tools/34.0.0/apksigner verify --verbose app/build/outputs/apk/production/release/app-production-release.apk | grep "Verified using"
```

**Expected output (All Builds):**
```
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): false
```

**What this means:**
- Modern Android Gradle Plugin (AGP 7.0+) uses **v2-only signing** by default for minSdk 29+
- v2 signing is more secure and sufficient for modern devices
- v1 signing (JAR signing) is legacy and only needed for older Android versions (<7.0)

✅ **Verification:**
- v2 signing present = correct ✅
- v1 can be omitted for minSdk 29+ ✅

**Why signing matters:**
- Android requires all APKs to be signed
- Debug builds use debug keystore (automatic)
- Release builds use production keystore (configured in `keystore.properties`)
- Signature can be extracted from v2-signed APKs using `apksigner verify --print-certs`

**Note:** Even though `build.gradle.kts` enables v1 signing, modern AGP may skip it when minSdk is high enough. This is expected and correct behavior.

---

### **Step 9: Archive APK to Artifacts**

Now archive the built APK for long-term storage with proper naming:

```bash
./archive-apk.sh local
```

**Expected output:**
```
Using default build type for local: debug

Archiving APK...
  Flavor:      local
  Build Type:  debug
  Version:     0.0.43
  Git SHA:     47e035b

  Source:      app/build/outputs/apk/local/debug/app-local-debug.apk
  Destination: ../artifacts/apks/local/app-local-debug-0.0.43-47e035b.apk

✓ Successfully archived APK (15M)

Archived APK location:
  ../artifacts/apks/local/app-local-debug-0.0.43-47e035b.apk

To list all archived APKs for this flavor:
  ls -lht ../artifacts/apks/local/
```

**What this does:**
- Copies APK from build output to permanent `artifacts/` directory
- Names file with version + git commit SHA for traceability
- Creates flavor-specific subdirectory if needed
- Uses smart defaults (local → debug, staging/production → release)

**Archive script features:**
```bash
# Smart defaults:
./archive-apk.sh local              # → local debug (default)
./archive-apk.sh staging            # → staging release (default)
./archive-apk.sh production         # → production release (default)

# Explicit build type (override defaults):
./archive-apk.sh local release      # → local release
./archive-apk.sh staging debug      # → staging debug
```

**Naming convention:**
```
app-{flavor}-{buildType}-{version}-{gitSHA}.apk

Examples:
  app-local-debug-0.0.43-47e035b.apk
  app-staging-release-0.0.43-47e035b.apk
  app-production-release-0.0.43-47e035b.apk
```

**Why archive APKs:**
- ✅ Long-term storage of release artifacts
- ✅ Git SHA in filename → know exact source code
- ✅ Easy to find specific versions
- ✅ Team can access previously built APKs
- ✅ Rollback capability (install old version if needed)

**View archived APKs:**
```bash
# List all local builds (newest first)
ls -lht ../artifacts/apks/local/

# List all staging builds
ls -lht ../artifacts/apks/staging/

# List all production builds
ls -lht ../artifacts/apks/production/
```

---

## Git Workflow: Tag Your Release

After building, verifying, and archiving, tag the release in git:

### **Step 10: Commit Version Bump**

```bash
cd /home/ben/sandbox/bbtec-mdm
git add android-client/app/build.gradle.kts
git status
```

**Expected output:**
```
Changes to be committed:
  modified:   android-client/app/build.gradle.kts
```

**Commit the change:**
```bash
git commit -m "chore: Bump Android client to v0.0.43"
```

**Expected output:**
```
[feature/offline-local-dev abc1234] chore: Bump Android client to v0.0.43
 1 file changed, 2 insertions(+), 2 deletions(-)
```

---

### **Step 11: Tag the Release**

```bash
git tag -a android-v0.0.43 -m "Android client v0.0.43

Features/changes in this release:
- [Describe what changed]
"
```

**Verify the tag was created:**
```bash
git tag -l "android-v*"
```

**Expected output:**
```
android-v0.0.42
android-v0.0.43
```

**What this gives you:**
- Permanent marker in git history
- Easy checkout: `git checkout android-v0.0.43`
- Reproducible builds from any tagged version
- Clear release history: `git log --oneline --decorate`

---

## Summary: What You Built

```
✅ APK Built:     app/build/outputs/apk/local/debug/app-local-debug.apk
✅ Version:       0.0.43-local (versionCode 43)
✅ Package:       com.bbtec.mdm.client
✅ Git Commit:    [Your commit SHA]
✅ Git Branch:    [Your branch name]
✅ Build Time:    [ISO 8601 timestamp]
✅ Signing:       v2 (debug keystore)
✅ Size:          ~15 MB
✅ Git Tag:       android-v0.0.43
```

---

## Next Steps

### **Install on Physical Device (Optional)**

If you want to test on a physical device:

```bash
# Option A: Direct install (requires USB)
adb devices
adb install -r app/build/outputs/apk/local/debug/app-local-debug.apk

# Option B: Via enrollment QR code (requires web dashboard)
# Upload APK to dashboard, generate QR code, scan with factory-reset device
```

### **Build Other Flavors**

```bash
# Staging release (for QA testing)
./gradlew assembleStagingRelease
# Output: app/build/outputs/apk/staging/release/app-staging-release.apk

# Production release (for deployment)
./gradlew assembleProductionRelease
# Output: app/build/outputs/apk/production/release/app-production-release.apk
```

### **Push to Remote (Share with Team)**

```bash
# Push commits and tags
git push origin feature/your-branch --tags
```

**Note:** The `--tags` flag is important - it pushes both commits AND the tag!

---

## Troubleshooting

### **Error: "Missing keystore password"**

**Full error:**
```
Missing keystore password - create keystore.properties or set KEYSTORE_PASSWORD env var
```

**Cause:** The `keystore.properties` file is missing (it's gitignored for security).

**Solution:**
```bash
cd android-client
cp keystore.properties.example keystore.properties
# Edit keystore.properties with actual credentials
```

⚠️  **SECURITY NOTICE:** The development keystore (`bbtec-mdm.keystore`) is compromised and should only be used for local testing. For production releases, use the production keystore. See `../android-client/SECURITY-NOTICE.md` for details.

**For development/testing only:**
- See `keystore.properties.example` for file structure
- Development keystore credentials available in secure password store
- **Never commit keystore.properties to git**

**For production releases:**
- Use `bbtec-mdm-PRODUCTION.keystore`
- Credentials stored securely in password manager
- See `../android-client/PRODUCTION-KEYSTORE-BACKUP.md`

---

### **Error: "SDK location not found"**

**Cause:** Android SDK path not configured.

**Solution:**
```bash
# Create local.properties file
echo "sdk.dir=/opt/android-sdk" > android-client/local.properties
```

---

### **Error: "Gradle sync failed"**

**Cause:** First-time setup or corrupted Gradle cache.

**Solution:**
```bash
# Clean Gradle cache
rm -rf ~/.gradle/caches/
./gradlew clean --refresh-dependencies
```

---

### **Build is extremely slow (first time)**

**Cause:** Gradle is downloading dependencies.

**Expected behavior:**
- First build: 2-5 minutes (downloads dependencies)
- Subsequent builds: 20-40 seconds (uses cached dependencies)

**Patience required!** ☕

---

### **"Permission denied" when running gradlew**

**Cause:** `gradlew` script is not executable.

**Solution:**
```bash
chmod +x gradlew
```

---

### **APK size is much larger than expected (>20 MB)**

**Explanation:**
- **Debug APKs:** 15-20 MB (includes debugging symbols, not optimized)
- **Release APKs:** 5-8 MB (minified, optimized, ProGuard enabled)

This is normal! Debug builds are intentionally larger for better debugging.

---

### **Git commit SHA shows "unknown"**

**Cause:** Building outside of a git repository or git not installed.

**Solution:**
```bash
# Verify git is accessible
git rev-parse --short HEAD

# If error, you're not in a git repo
cd /home/ben/sandbox/bbtec-mdm/android-client
git status
```

---

## Quick Reference Card

**Full build sequence (copy-paste friendly):**

```bash
# Navigate to Android client
cd /home/ben/sandbox/bbtec-mdm/android-client

# 1. Check current version
grep -E "versionCode|versionName" app/build.gradle.kts | head -2

# 2. Bump version (adjust numbers as needed)
sed -i 's/versionCode = 42/versionCode = 43/' app/build.gradle.kts
sed -i 's/versionName = "0.0.42"/versionName = "0.0.43"/' app/build.gradle.kts

# 3. Clean build
./gradlew clean

# 4. Build APK
./gradlew assembleLocalDebug

# 5. Verify
ls -lh app/build/outputs/apk/local/debug/app-local-debug.apk
cat app/build/generated/source/buildConfig/local/debug/com/bbtec/mdm/client/BuildConfig.java | grep -E "VERSION|GIT_"

# 6. Archive APK
./archive-apk.sh local

# 7. Commit and tag
cd ..
git add android-client/app/build.gradle.kts
git commit -m "chore: Bump Android client to v0.0.43"
git tag -a android-v0.0.43 -m "Android client v0.0.43"
```

---

## Related Documentation

- **[android-build-variants.md](android-build-variants.md)** - Complete reference for build flavors, signing, and configuration
- **[development-setup.md](development-setup.md)** - Initial project setup and environment configuration
- **[android-qr-provisioning.md](android-qr-provisioning.md)** - Device provisioning and QR code generation

---

**Last Updated:** 2025-11-12
**Tutorial Version:** 1.0
**Tested Android Client Version:** 0.0.42

---

## Feedback

If you encounter issues not covered in this tutorial, please:
1. Check the troubleshooting section above
2. Review `android-build-variants.md` for detailed reference
3. Ask in team chat or create a GitHub issue

**Happy building!** 🚀
