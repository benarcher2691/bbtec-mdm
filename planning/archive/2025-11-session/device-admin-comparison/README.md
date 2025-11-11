# Device Admin XML Comparison

**Date:** 2025-11-06
**Purpose:** Compare device_admin.xml policies between TestDPC and BBTec MDM to identify missing policies

## Context

Phase 2 testing FAILED - BBTec MDM v0.0.9 still provisions as Profile Owner (User 10) despite adding ProvisioningSuccessActivity.

## Investigation

TestDPC achieves Device Owner status on Android 10 with QR provisioning. We need to find what's different in their device_admin.xml that signals Device Owner capability.

## Files to Generate

1. `testdpc-device-admin.txt` - Extracted from TestDPC APK
2. `bbtec-device-admin.txt` - Extracted from BBTec MDM v0.0.9 APK
3. Comparison analysis (diff output)

## Commands

After session restart with `aapt` in PATH:

```bash
# Extract from TestDPC
aapt dump xmltree artifacts/apks/com.afwsamples.testdpc_9.0.12-9012_minAPI21\(nodpi\)_apkmirror.com.apk \
  res/xml/device_admin.xml > planning/device-admin-comparison/testdpc-device-admin.txt

# Extract from BBTec MDM v0.0.9
aapt dump xmltree artifacts/apks/bbtec-mdm-client-0.0.9.apk \
  res/xml/device_admin.xml > planning/device-admin-comparison/bbtec-device-admin.txt

# Compare
diff -u planning/device-admin-comparison/testdpc-device-admin.txt \
        planning/device-admin-comparison/bbtec-device-admin.txt
```

## Next Steps

1. Execute extraction commands
2. Analyze differences
3. If policies are missing, add them to BBTec MDM
4. Build v0.0.10 and test again
5. If no policy differences, move to Fallback Approach 2 (QR code fields)
