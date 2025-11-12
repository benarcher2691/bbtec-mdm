# AndroidManifest.xml Comparison Analysis

**Date:** 2025-11-06
**Status:** ✅ Option 1 Complete - No smoking gun found in manifest

---

## Summary

Compared AndroidManifest.xml from TestDPC (331 lines) vs BBTec MDM v0.0.10 (240 lines). Found no critical differences that would explain Device Owner vs Profile Owner provisioning behavior.

---

## Key Findings

### Provisioning Activities ✅ IDENTICAL

**Both apps have the same provisioning activities:**
- `GET_PROVISIONING_MODE` activity (Android 12+)
- `PROVISIONING_SUCCESSFUL` activity
- `PROFILE_PROVISIONING_COMPLETE` receiver intent

### DeviceAdminReceiver ✅ IDENTICAL

**Both apps have identical receiver configuration:**
```xml
<receiver android:name=".DeviceAdminReceiver"
    android:permission="android.permission.BIND_DEVICE_ADMIN"
    android:exported="true">
    <intent-filter>
        <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
        <action android:name="android.app.action.PROFILE_PROVISIONING_COMPLETE" />
        <action android:name="android.intent.action.BOOT_COMPLETED" />
        <action android:name="android.app.action.PROFILE_OWNER_CHANGED" />
        <action android:name="android.app.action.DEVICE_OWNER_CHANGED" />
    </intent-filter>
</receiver>
```

### Permissions

**TestDPC has many more permissions (41 vs 12):**
- Many `MANAGE_DEVICE_POLICY_*` permissions (Android 14+ granular policies)
- `com.google.android.setupwizard.SETUP_COMPAT_SERVICE`
- `GET_ACCOUNTS`, `MANAGE_ACCOUNTS`
- Location permissions
- Storage permissions

**BBTec MDM has:**
- Basic permissions (INTERNET, BOOT_COMPLETED, etc.)
- Device Owner essentials (WRITE_SECURE_SETTINGS, CHANGE_WIFI_STATE)

**Analysis:** The extra permissions in TestDPC are for additional features, not Device Owner capability. Android 10 doesn't use Android 14 permissions.

### Uses-Feature

**TestDPC declares:**
- `android.hardware.wifi` (not required)
- `android.hardware.touchscreen` (not required)

**BBTec MDM:**
- No uses-feature declarations

**Analysis:** These features are marked `required=false` so they don't affect provisioning.

---

## Conclusion

The AndroidManifest.xml files are **functionally equivalent** for Device Owner provisioning purposes. TestDPC has more features and permissions for its full DPC functionality, but nothing that signals Device Owner capability to Android 10.

**The manifest is NOT the differentiator.**

---

## Next Investigation

Moving to **Option 2: QR Code Provisioning Flags**

Check if Android 10 requires specific QR fields like:
- `PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED`
- `PROVISIONING_USE_MOBILE_DATA`
- Other Android 10 specific flags

---

**Files:**
- TestDPC manifest: `planning/manifest-comparison/testdpc-manifest-full.txt`
- BBTec manifest: `planning/manifest-comparison/bbtec-manifest-full.txt`

**Created:** 2025-11-06
