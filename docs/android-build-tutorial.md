# Android APK Build Tutorial

## Overview

This step-by-step tutorial walks you through building an Android APK from scratch, including version management, Convex deployment, and git workflow. Perfect for new team members or as a refresher for experienced developers.

**What you'll learn:**
- How to manage versions across branches
- When and how to bump version numbers
- How to deploy Convex schema changes
- How to build APKs for different environments
- How to verify build provenance (git metadata)
- Complete git workflow for releases
- Integrated release workflows (local/staging/production)

**Prerequisites:**
- Android SDK installed at `/opt/android-sdk/`
- Git repository cloned
- `keystore.properties` file configured (see `android-build-variants.md`)
- Node.js and npm installed (for Convex deployment)

**Time required:**
- Local testing: ~5 minutes
- Staging release: ~10 minutes
- Production release: ~15 minutes

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

## Understanding Version Management

### **Semantic Versioning**

We use semantic versioning: `MAJOR.MINOR.PATCH` (e.g., `0.0.45`)

**Currently in early development:**
- `MAJOR = 0` - Pre-release (breaking changes allowed)
- `MINOR = 0` - Not yet stabilized
- `PATCH = 45` - Increment with each release

**Version components:**
- `versionCode` - Integer that MUST increment with every release (Android requirement)
- `versionName` - Human-readable string (e.g., "0.0.45")

### **Branch-Based Version Strategy**

```
master (production)
  versionCode: 44, versionName: "0.0.44"
  ↑
  └─ Merge from development

development (staging)
  versionCode: 45, versionName: "0.0.45"
  ↑
  └─ Merge from feature branch

feature/web-gui-2 (local testing)
  versionCode: 45, versionName: "0.0.45"  ← You bump here first!
```

**Key principles:**
1. **Bump version in feature branch** - Not in development or master
2. **One version per branch** - Don't bump multiple times in same branch
3. **Version increments when merging** - development gets new version from feature branch
4. **Master always lags** - It gets versions from development

### **When to Bump Versions**

**Bump PATCH version (+1) when:**
- ✅ Bug fixes
- ✅ Small improvements
- ✅ UI tweaks
- ✅ New APK build for testing/deployment

**DON'T bump when:**
- ❌ Work in progress (not ready for testing)
- ❌ Experimental changes
- ❌ Local-only testing

**Example timeline:**
1. Start feature branch → version is 44 (inherited from development)
2. Finish feature → bump to 45
3. Build and test → still 45
4. Merge to development → development becomes 45
5. Later, start new feature → inherit 45 from development
6. Finish new feature → bump to 46

### **What Happens When You Merge Branches**

**Scenario: You have local changes with version 45, development is still on 44**

```bash
git checkout development
git merge feature/web-gui-2
# Result: development now has version 45 from your feature branch
```

**No conflicts!** The newer version (45) overwrites the old version (44) in `build.gradle.kts`.

**After merge:**
- ✅ Development has your version (45)
- ✅ Git history preserved
- ✅ No need to bump again

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
versionCode = 45
versionName = "0.0.45"
versionNameSuffix = "-local"
versionNameSuffix = "-staging"
```

**What you're seeing:**
- `versionCode = 45` - Internal Android version number (must increment)
- `versionName = "0.0.45"` - User-visible version string
- `versionNameSuffix` - Automatic suffixes added by flavors (ignore these)

**Note:** The suffix lines are normal - they show flavor-specific suffixes that get appended automatically (`-local`, `-staging`).

**Now check what's been released:**
```bash
git tag -l "android-v*" | sort -V | tail -5
```

**Example output:**
```
android-v0.0.44
```

**What this means:**
- Latest tagged version: `0.0.44`
- Current version in code: `0.0.45`
- **Version 45 is new and untagged** ✅

---

### **Step 2: Decide on Version (Bump if Needed)**

From Step 1, you saw the version in `build.gradle.kts` (e.g., version 45).

**This is the version that will be built into your next APK.**

**Decision matrix:**

| Situation | Action |
|-----------|--------|
| Code version (45) > Latest tag (44) | ✅ **Skip to Step 3** - Already bumped |
| Code version = Latest tag | ⚠️ **Bump below** - Need new version |
| Working on unfinished feature | ❌ **Don't bump yet** - Wait until ready |

---

**To manually bump the version (example: 45 → 46):**

```bash
sed -i 's/versionCode = 45/versionCode = 46/' app/build.gradle.kts
sed -i 's/versionName = "0.0.45"/versionName = "0.0.46"/' app/build.gradle.kts
```

**Verify the change:**
```bash
grep -A2 "versionCode\|versionName" app/build.gradle.kts | grep -E "versionCode|versionName"
```

**Expected output:**
```
versionCode = 46
versionName = "0.0.46"
versionNameSuffix = "-local"
versionNameSuffix = "-staging"
```

✅ **Key check:** First two lines should show the version you want to build

**💡 Important notes:**
- **Versions are NEVER automatically bumped** - you must change them manually
- `versionCode` - Must increment with every release (Google Play requirement)
- `versionName` - Semantic versioning: `MAJOR.MINOR.PATCH` (e.g., 0.0.46)
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

**Expected output (example for Staging Release):**
```java
public static final String BUILD_TYPE = "release";
public static final int VERSION_CODE = 45;
public static final String VERSION_NAME = "0.0.45-staging";
public static final String BUILD_TIMESTAMP = "2025-11-14T10:30:15.123456789Z";
public static final String GIT_BRANCH = "feature/web-gui-2";
public static final String GIT_COMMIT_SHA = "c166445";
```

**Note:** VERSION_NAME suffix changes per environment:
- Local: `"0.0.45-local"`
- Staging: `"0.0.45-staging"`
- Production: `"0.0.45"` (no suffix)

🎉 **This is build provenance in action!**

**What you're seeing:**
- `VERSION_CODE = 45` - Your version number ✅
- `VERSION_NAME` - Version with environment-specific suffix ✅
- `GIT_COMMIT_SHA = "c166445"` - The exact git commit this APK was built from ✅
- `GIT_BRANCH = "feature/..."` - The branch name ✅
- `BUILD_TIMESTAMP` - Exact build time (ISO 8601 format) ✅

**Why this matters:**
- You can trace any production APK back to its exact source code
- Reproducible builds: `git checkout c166445` → rebuild → same APK
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

**Expected output (example for Staging Release):**
```
package: name='com.bbtec.mdm.client.staging' versionCode='45' versionName='0.0.45-staging' platformBuildVersionName='14' platformBuildVersionCode='34' compileSdkVersion='34' compileSdkVersionCodename='14'
```

**Expected package names per environment:**
- Local: `com.bbtec.mdm.client` (base package)
- Staging: `com.bbtec.mdm.client.staging` (with `.staging` suffix)
- Production: `com.bbtec.mdm.client` (base package)

✅ **Verify these values:**
- `name=` - Package name matches environment ✅
- `versionCode='45'` - Matches what you set ✅
- `versionName='0.0.45-...'` - Matches with environment suffix ✅
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

**For Local Debug:**
```bash
./archive-apk.sh local
```

**For Staging Release:**
```bash
./archive-apk.sh staging
```

**For Production Release:**
```bash
./archive-apk.sh production
```

**Expected output (example for Staging):**
```
Using default build type for staging: release

Archiving APK...
  Flavor:      staging
  Build Type:  release
  Version:     0.0.45
  Git SHA:     c166445

  Source:      app/build/outputs/apk/staging/release/app-staging-release.apk
  Destination: ../artifacts/apks/staging/app-staging-release-0.0.45-c166445.apk

✓ Successfully archived APK (12M)

Archived APK location:
  ../artifacts/apks/staging/app-staging-release-0.0.45-c166445.apk

To list all archived APKs for this flavor:
  ls -lht ../artifacts/apks/staging/
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
  app-local-debug-0.0.45-c166445.apk
  app-staging-release-0.0.45-c166445.apk
  app-production-release-0.0.45-c166445.apk
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

## ⚠️  CRITICAL: Deploy Convex Schema Changes

### **Step 10: Deploy Convex to Development/Staging**

**IMPORTANT:** If you made ANY changes to Convex schema or functions, you MUST deploy them BEFORE tagging your release!

**When to deploy:**
- ✅ Changed any `convex/*.ts` files
- ✅ Modified Convex schema (`convex/schema.ts`)
- ✅ Updated queries, mutations, or actions
- ✅ Added new Convex functions
- ✅ Building staging or production APKs

**When to skip:**
- ❌ Only changed Android code
- ❌ Only changed web UI
- ❌ No Convex changes in your branch

---

**For Staging/Development builds:**

```bash
cd /home/ben/sandbox/bbtec-mdm
npm run convex:deploy:dev
```

**Expected output:**
```
✔ Deploying Convex functions to kindly-mule-339 (dev)
✔ Schema validation passed
✔ Functions deployed successfully
✔ Deployment complete!
```

**What this does:**
- Deploys schema and functions to `kindly-mule-339` (dev Convex deployment)
- Vercel preview deployments will use this
- Staging APKs will connect to this deployment
- Preserves your local `.env.local` (doesn't affect local development)

---

**For Production builds:**

```bash
cd /home/ben/sandbox/bbtec-mdm
npm run convex:deploy:prod
```

**Expected output:**
```
✔ Deploying Convex functions to expert-lemur-691 (prod)
✔ Schema validation passed
✔ Functions deployed successfully
✔ Deployment complete!
```

**What this does:**
- Deploys schema and functions to `expert-lemur-691` (production Convex deployment)
- Production Vercel deployment will use this
- Production APKs will connect to this deployment
- Preserves your local `.env.local` (doesn't affect local development)

---

**Why this matters:**

**❌ If you DON'T deploy Convex before building APK:**
- APK expects new schema fields → crashes when field missing
- New functions not available → API calls fail
- Devices can't register or send heartbeats
- Enrollment fails

**✅ If you DO deploy Convex first:**
- Schema matches what APK expects
- All functions available
- Smooth deployment
- No surprises

**Pro tip:** Make Convex deployment part of your muscle memory:
```bash
# Staging workflow
npm run convex:deploy:dev
cd android-client && ./gradlew assembleStagingRelease

# Production workflow
npm run convex:deploy:prod
cd android-client && ./gradlew assembleProductionRelease
```

---

## Git Workflow: Commit, Tag, and Push

### **Step 11: Commit Version Bump**

Navigate back to the repository root and commit the version change:

```bash
cd /home/ben/sandbox/bbtec-mdm
git add android-client/app/build.gradle.kts
git status
```

**Expected output:**
```
On branch feature/web-gui-2
Changes to be committed:
  modified:   android-client/app/build.gradle.kts
```

**Commit the change:**
```bash
git commit -m "chore: bump Android client to v0.0.45"
```

**Expected output:**
```
[feature/web-gui-2 abc1234] chore: bump Android client to v0.0.45
 1 file changed, 2 insertions(+), 2 deletions(-)
```

**Why commit first:**
- Git tag points to a specific commit
- Commit must exist before tagging
- Clean history: version bump → tag → push

---

### **Step 12: Tag the Release**

Create an annotated tag for this release:

```bash
git tag -a android-v0.0.45 -m "Android client v0.0.45

Features/changes in this release:
- Critical heartbeat reliability fixes (zombie state prevention)
- Web UI v0.0.5 improvements
- Dynamic device status monitoring

Built from commit: c166445
Build date: 2025-11-14
"
```

**Verify the tag was created:**
```bash
git tag -l "android-v*" | tail -3
```

**Expected output:**
```
android-v0.0.43
android-v0.0.44
android-v0.0.45
```

**What this gives you:**
- Permanent marker in git history
- Easy checkout: `git checkout android-v0.0.45`
- Reproducible builds from any tagged version
- Clear release history: `git log --oneline --decorate`

**Tag best practices:**
- Use annotated tags (`-a`) not lightweight tags
- Include meaningful release notes
- Reference the commit SHA
- Mention major features/fixes

---

### **Step 13: Push Commits and Tags**

Push your changes to the remote repository:

```bash
git push origin feature/web-gui-2 --tags
```

**Expected output:**
```
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Delta compression using up to 8 threads
Compressing objects: 100% (3/3), done.
Writing objects: 100% (3/3), 456 bytes | 456.00 KiB/s, done.
Total 3 (delta 2), reused 0 (delta 0), pack-reused 0
To github.com:yourusername/bbtec-mdm.git
   abc1234..def5678  feature/web-gui-2 -> feature/web-gui-2
 * [new tag]         android-v0.0.45 -> android-v0.0.45
```

**Important:** The `--tags` flag pushes both commits AND tags!

**What happens now:**
- ✅ Your feature branch is backed up on GitHub
- ✅ Tag is visible to all team members
- ✅ Ready to create PR to `development`

---

## Summary: What You Built

**For Local Debug Build:**
```
✅ APK Built:     app/build/outputs/apk/local/debug/app-local-debug.apk
✅ Version:       0.0.45-local (versionCode 45)
✅ Package:       com.bbtec.mdm.client
✅ Git Commit:    c166445
✅ Git Branch:    feature/web-gui-2
✅ Build Time:    2025-11-14T10:30:15Z
✅ Signing:       v2 (debug keystore)
✅ Size:          ~15 MB
✅ Archived:      artifacts/apks/local/app-local-debug-0.0.45-c166445.apk
✅ Git Tag:       android-v0.0.45
```

**For Staging Release Build:**
```
✅ APK Built:     app/build/outputs/apk/staging/release/app-staging-release.apk
✅ Version:       0.0.45-staging (versionCode 45)
✅ Package:       com.bbtec.mdm.client.staging
✅ Git Commit:    c166445
✅ Git Branch:    feature/web-gui-2
✅ Build Time:    2025-11-14T10:30:15Z
✅ Signing:       v2 (release keystore)
✅ Size:          ~12 MB
✅ Archived:      artifacts/apks/staging/app-staging-release-0.0.45-c166445.apk
✅ Git Tag:       android-v0.0.45
✅ Convex:        Deployed to kindly-mule-339 (dev)
```

**For Production Release Build:**
```
✅ APK Built:     app/build/outputs/apk/production/release/app-production-release.apk
✅ Version:       0.0.45 (versionCode 45)
✅ Package:       com.bbtec.mdm.client
✅ Git Commit:    c166445
✅ Git Branch:    master
✅ Build Time:    2025-11-14T10:30:15Z
✅ Signing:       v2 (release keystore)
✅ Size:          ~12 MB
✅ Archived:      artifacts/apks/production/app-production-release-0.0.45-c166445.apk
✅ Git Tag:       android-v0.0.45
✅ Convex:        Deployed to expert-lemur-691 (prod)
```

---

## Complete Release Workflows

Here are three integrated workflows for different scenarios:

### **Workflow 1: Local Testing (Fast Iteration)**

**When to use:** Quick testing on USB-connected device during development.

```bash
# 1. Navigate to project
cd /home/ben/sandbox/bbtec-mdm/android-client

# 2. Check version (should already be bumped)
grep -E "versionCode|versionName" app/build.gradle.kts | head -2

# 3. Build APK
./gradlew clean assembleLocalDebug

# 4. Verify build
ls -lh app/build/outputs/apk/local/debug/app-local-debug.apk

# 5. Install on device
adb devices
adb install -r app/build/outputs/apk/local/debug/app-local-debug.apk

# 6. Setup port forwarding (REQUIRED!)
adb reverse tcp:3000 tcp:3000

# 7. Test the app
adb shell am start -n com.bbtec.mdm.client/.MainActivity
```

**Notes:**
- ❌ No Convex deployment needed (uses local Convex)
- ❌ No git commit/tag needed (work in progress)
- ❌ No archive needed (temporary build)
- ✅ Port forwarding required every time you disconnect device!

---

### **Workflow 2: Staging Release (QA Testing)**

**When to use:** Testing against cloud staging environment before production.

```bash
# 1. Navigate to project root
cd /home/ben/sandbox/bbtec-mdm

# 2. Check version (should already be bumped in feature branch)
cd android-client
grep -E "versionCode|versionName" app/build.gradle.kts | head -2

# 3. Deploy Convex to dev/staging
cd ..
npm run convex:deploy:dev
# ✅ Wait for: "Deployment complete!"

# 4. Build staging APK
cd android-client
./gradlew clean assembleStagingRelease

# 5. Verify build
ls -lh app/build/outputs/apk/staging/release/app-staging-release.apk
/opt/android-sdk/build-tools/34.0.0/aapt dump badging \
  app/build/outputs/apk/staging/release/app-staging-release.apk | \
  grep -E "package:|versionCode|versionName"

# 6. Archive APK
./archive-apk.sh staging

# 7. Commit version bump
cd ..
git add android-client/app/build.gradle.kts
git commit -m "chore: bump Android client to v0.0.45"

# 8. Tag release
git tag -a android-v0.0.45 -m "Android client v0.0.45

Staging release for QA testing
- Feature: [describe]
- Fixes: [describe]
"

# 9. Push to GitHub
git push origin feature/web-gui-2 --tags

# 10. Create PR to development
gh pr create --base development --head feature/web-gui-2 \
  --title "Android v0.0.45 + [your features]" \
  --body "See commits for details"

# 11. After PR merged, deploy staging APK to dashboard
# (Upload to enrollment/update-client page)
```

**Checklist:**
- ✅ Convex deployed to dev
- ✅ APK built with staging config
- ✅ Version bumped and committed
- ✅ Release tagged
- ✅ Changes pushed to GitHub
- ✅ PR created to development
- ✅ APK uploaded to dashboard

---

### **Workflow 3: Production Release (Deployment)**

**When to use:** Deploying to production for real device enrollment.

**Prerequisites:**
- ✅ Staging tested and approved
- ✅ Changes merged to `development`
- ✅ PR from `development` → `master` approved

```bash
# 1. Checkout master and pull latest
cd /home/ben/sandbox/bbtec-mdm
git checkout master
git pull origin master

# 2. Verify version is correct
cd android-client
grep -E "versionCode|versionName" app/build.gradle.kts | head -2
# Should match what was tested in staging!

# 3. Deploy Convex to production
cd ..
npm run convex:deploy:prod
# ✅ Wait for: "Deployment complete!"

# 4. Build production APK
cd android-client
./gradlew clean assembleProductionRelease

# 5. Verify build extensively
ls -lh app/build/outputs/apk/production/release/app-production-release.apk

# Check package and version
/opt/android-sdk/build-tools/34.0.0/aapt dump badging \
  app/build/outputs/apk/production/release/app-production-release.apk | \
  grep -E "package:|versionCode|versionName"
# Expected: package='com.bbtec.mdm.client' versionCode='45' versionName='0.0.45'

# Check build provenance
cat app/build/generated/source/buildConfig/production/release/com/bbtec/mdm/client/BuildConfig.java | \
  grep -E "VERSION|GIT_|BUILD_"

# Verify signing
/opt/android-sdk/build-tools/34.0.0/apksigner verify --verbose \
  app/build/outputs/apk/production/release/app-production-release.apk | \
  grep "Verified using"

# 6. Archive APK
./archive-apk.sh production

# 7. Tag release (if not already tagged in staging)
cd ..
git tag -a android-v0.0.45 -m "Android client v0.0.45 - PRODUCTION

Production release
- Feature: [describe]
- Fixes: [describe]

Tested in staging: [date]
Approved by: [name]
"

# 8. Push tag to master
git push origin master --tags

# 9. Upload production APK to dashboard
# (Upload to enrollment/update-client page)

# 10. Test production enrollment
# (Generate QR code, factory reset device, scan, verify enrollment)

# 11. Monitor production logs for 24 hours
# (Check heartbeats, device status, no errors)
```

**Production checklist:**
- ✅ Convex deployed to production
- ✅ APK built with production config
- ✅ Package name verified (`com.bbtec.mdm.client`)
- ✅ Version verified
- ✅ Build provenance checked
- ✅ Signing verified
- ✅ APK archived
- ✅ Release tagged on master
- ✅ APK uploaded to production dashboard
- ✅ Enrollment tested
- ✅ Monitoring in place

---

## Next Steps

### **Install on Physical Device (Testing)**

If you want to test on a physical device:

```bash
# Option A: Direct install (requires USB)
adb devices
adb install -r app/build/outputs/apk/local/debug/app-local-debug.apk

# For local builds: Setup port forwarding
adb reverse tcp:3000 tcp:3000

# Option B: Via enrollment QR code (staging/production)
# 1. Upload APK to dashboard (enrollment/update-client)
# 2. Generate enrollment QR code
# 3. Factory reset device
# 4. Scan QR code during setup
# 5. Device downloads APK and enrolls automatically
```

### **Build Other Flavors**

```bash
# Local debug (fast iteration)
./gradlew assembleLocalDebug
# Output: app/build/outputs/apk/local/debug/app-local-debug.apk

# Staging release (for QA testing)
./gradlew assembleStagingRelease
# Output: app/build/outputs/apk/staging/release/app-staging-release.apk

# Production release (for deployment)
./gradlew assembleProductionRelease
# Output: app/build/outputs/apk/production/release/app-production-release.apk
```

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

### **Convex deployment fails: "Invalid schema"**

**Cause:** Schema validation error in Convex files.

**Solution:**
```bash
# Check for syntax errors in convex/*.ts files
cd /home/ben/sandbox/bbtec-mdm
npx convex dev --local
# Look for error messages
```

---

### **APK crashes on device: "Field not found"**

**Cause:** You forgot to deploy Convex schema before building APK!

**Solution:**
```bash
# Deploy Convex first
npm run convex:deploy:dev   # For staging
npm run convex:deploy:prod  # For production

# Then rebuild APK
cd android-client
./gradlew clean assembleStagingRelease
```

**Prevention:** Make Convex deployment part of your workflow (see Step 10)

---

## Quick Reference Card

**Full build sequence (copy-paste friendly):**

### **Local Testing:**
```bash
cd /home/ben/sandbox/bbtec-mdm/android-client
./gradlew clean assembleLocalDebug
adb install -r app/build/outputs/apk/local/debug/app-local-debug.apk
adb reverse tcp:3000 tcp:3000
```

### **Staging Release:**
```bash
cd /home/ben/sandbox/bbtec-mdm
npm run convex:deploy:dev
cd android-client
./gradlew clean assembleStagingRelease
./archive-apk.sh staging
cd ..
git add android-client/app/build.gradle.kts
git commit -m "chore: bump Android client to v0.0.45"
git tag -a android-v0.0.45 -m "Staging release v0.0.45"
git push origin feature/web-gui-2 --tags
```

### **Production Release:**
```bash
cd /home/ben/sandbox/bbtec-mdm
git checkout master && git pull
npm run convex:deploy:prod
cd android-client
./gradlew clean assembleProductionRelease
./archive-apk.sh production
cd ..
git tag -a android-v0.0.45 -m "Production release v0.0.45"
git push origin master --tags
```

---

## Related Documentation

- **[android-build-variants.md](android-build-variants.md)** - Complete reference for build flavors, signing, and configuration
- **[development-setup.md](development-setup.md)** - Initial project setup and environment configuration
- **[android-qr-provisioning.md](android-qr-provisioning.md)** - Device provisioning and QR code generation
- **[deployment-procedures.md](deployment-procedures.md)** - Production deployment guide

---

**Last Updated:** 2025-11-14
**Tutorial Version:** 2.0
**Tested Android Client Version:** 0.0.45

---

## Feedback

If you encounter issues not covered in this tutorial, please:
1. Check the troubleshooting section above
2. Review `android-build-variants.md` for detailed reference
3. Ask in team chat or create a GitHub issue

**Happy building!** 🚀
