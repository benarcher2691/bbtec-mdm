# TestDPC Baseline Test - Instructions

**Goal:** Determine if the Android provisioning issue is in our APK or the QR format/device.

**Status:** Ready to upload TestDPC and test

---

## ✅ Completed Steps

1. ✅ Downloaded TestDPC v9.0.12 APK
2. ✅ Extracted signature checksum: `gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w`
3. ✅ Created QR config template: `testdpc-qr-config.json`

---

## 📋 Next Steps

### 1. Upload TestDPC to Web Portal

**File:** `com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk` (11 MB)

**Upload to:**
- Production: https://bbtec-mdm.vercel.app
- Or localhost:3000 if testing locally

**Steps:**
1. Navigate to APK Upload page
2. Upload `com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk`
3. Copy the Convex storage URL from upload success message

### 2. Update QR Config

**File:** `testdpc-qr-config.json`

**Replace this line:**
```json
"PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "REPLACE_WITH_CONVEX_STORAGE_URL"
```

**With your Convex storage URL:**
```json
"PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://expert-lemur-691.convex.cloud/api/storage/YOUR_STORAGE_ID"
```

### 3. Generate QR Code

**Option A: Use your QR generator**
```bash
cd /home/ben/sandbox/qr-generator
# Open index.html in browser
# Paste contents of testdpc-qr-config.json
```

**Option B: Use online QR generator**
- Copy contents of `testdpc-qr-config.json`
- Paste into any QR code generator
- Settings: 512x512px, Error correction: M (Medium)

### 4. Test Provisioning

**Device:** Android 13 Hannspree (or Android 10 Hannspree Zeus)

**Steps:**
1. Factory reset device
2. On Welcome screen, tap 6 times to activate QR scanner
3. Scan the generated QR code
4. Observe the provisioning process

**Monitor:**
- Check Convex dashboard for `downloadCount` increasing
- Watch device screen for download/install progress
- Note any error messages

---

## 🎯 Expected Results

### ✅ If TestDPC Works (Provisions Successfully)

**Conclusion:** The problem is in OUR APK
- Our manifest configuration is wrong
- Our signing is wrong
- Our DeviceAdminReceiver is incomplete

**Next steps:** Compare our APK with TestDPC:
- Manifest structure
- Intent filters
- device_admin.xml policies
- Signing configuration

### ❌ If TestDPC Fails (Same Error as Our APK)

**Conclusion:** The problem is NOT our APK
- QR code format is wrong
- Device compatibility issue
- Signature checksum encoding issue
- Network/download issue

**Next steps:** Debug QR format and device compatibility

---

## 📁 Files

- **APK:** `com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk`
- **QR Config:** `testdpc-qr-config.json`
- **TestDPC Info:**
  - Package: `com.afwsamples.testdpc`
  - Component: `com.afwsamples.testdpc/com.afwsamples.testdpc.DeviceAdminReceiver`
  - Signature: `gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w`
  - Version: 9.0.12
  - Size: 11 MB

---

## 🔍 Debugging

If TestDPC provisioning fails, check:

1. **Download Count:**
   ```
   Convex dashboard → apkMetadata table → find TestDPC → check downloadCount
   ```

2. **APK URL accessible:**
   ```bash
   curl -I https://expert-lemur-691.convex.cloud/api/storage/YOUR_STORAGE_ID
   # Should return: 200 OK, Content-Type: application/vnd.android.package-archive
   ```

3. **Device logs (if ADB available after failure):**
   ```bash
   adb logcat | grep -i "provision"
   ```

4. **Component verification:**
   ```bash
   unzip -l com.afwsamples.testdpc_*.apk | grep DeviceAdminReceiver
   # Should show: com/afwsamples/testdpc/DeviceAdminReceiver.class
   ```

---

**Created:** 2025-11-05
**Last Updated:** 2025-11-05
