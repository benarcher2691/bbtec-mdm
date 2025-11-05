# Artifacts Directory

This directory stores critical build artifacts needed to reproduce test scenarios.

**Purpose:** Version control important binaries, test configurations, and reference files that are essential for debugging and reproducing issues.

---

## 📂 Directory Structure

```
artifacts/
├── apks/           # APK files used in testing
└── README.md       # This file
```

---

## 📱 APKs (`apks/`)

Contains APK files used in baseline tests and debugging sessions.

### Current APKs

1. **`bbtec-mdm-client-0.0.8.apk`** (12 MB)
   - Custom MDM client application
   - Version: 0.0.8
   - Build date: 2025-11-04
   - Package: `com.bbtec.mdm.client`
   - Signature checksum: `U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE`
   - Convex storage ID: `kg2c0n5m61jc01hx00crgs3pmd7tr64z`
   - Status: Tested - provisioned but registration failed (missing admin extras in QR)

2. **`com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk`** (11 MB)
   - Google's TestDPC baseline test app
   - Version: 9.0.12 (build 9012)
   - Source: APKMirror (official Google sample)
   - Package: `com.afwsamples.testdpc`
   - Signature checksum: `gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w`
   - Convex storage ID: `kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj`
   - Status: ✅ Successfully provisioned as Device Owner on Android 10

### Documentation

- **APK to QR mapping:** `planning/qr-configs/APK-MAPPING.md`
- **Test results:** `planning/SESSION-4-STATUS.md`
- **Root cause analysis:** `planning/REGISTRATION-FAILURE-ROOT-CAUSE.md`

---

## 🔄 When to Add New Artifacts

Add artifacts to this directory when:
1. **Critical test milestones** - APKs that proved or disproved hypotheses
2. **Baseline comparisons** - Reference implementations (like TestDPC)
3. **Regression testing** - Known-good builds to test against
4. **Debugging reference** - Builds that exhibited specific behaviors

**Do NOT add:**
- Development/work-in-progress builds
- Unverified builds
- Duplicate versions

---

## 📏 Size Guidelines

- GitHub file limit: 50 MB per file
- GitHub repo limit: 1 GB (soft), 5 GB (hard)
- Current artifacts total: ~23 MB

**Before adding large files (>10 MB):**
1. Verify it's essential for reproduction
2. Consider Git LFS if total artifacts exceed 100 MB
3. Document why it's being added

---

## 🔐 Security Note

APKs in this directory:
- Are signed with development certificates (not production)
- Should NOT be distributed to end users
- Are for testing and debugging purposes only
- May contain debug flags or logging

**Production APKs should be:**
- Signed with production keystore
- Distributed via proper channels (Play Store, MDM)
- Never committed to public repositories

---

## 🗑️ Cleanup Policy

Review artifacts annually or when repo size becomes an issue:
1. Archive builds older than 1 year to external storage
2. Keep only critical baseline tests
3. Document removal in git history

---

**Created:** 2025-11-05
**Last Updated:** 2025-11-05
