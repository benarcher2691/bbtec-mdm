# TestDPC QR Generation Setup

**Purpose:** Generate QR codes for Google's Test DPC to verify Device Owner mode can be achieved on Android 10 devices.

---

## Step 1: Upload TestDPC APK

1. **APK Location:** `/home/ben/sandbox/bbtec-mdm/com.afwsamples.testdpc_9.0.12-9012_minAPI21(nodpi)_apkmirror.com.apk`

2. **Upload via Web UI:**
   - Go to https://bbtec-mdm.vercel.app
   - Navigate to APK upload section
   - Upload the TestDPC APK file
   - **Note the Convex Storage ID** (e.g., `kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj`)

3. **Update Code:**
   Edit `src/app/actions/enrollment.ts` line 56:
   ```typescript
   const testdpcStorageId = 'UPLOAD_TESTDPC_APK_FIRST' // Replace with actual storage ID
   ```

   Change to:
   ```typescript
   const testdpcStorageId = 'kg2bbwpeezdeqqs0dgk1zahhbx7ttdyj' // Your actual storage ID
   ```

4. **Commit and deploy:**
   ```bash
   git add src/app/actions/enrollment.ts
   git commit -m "fix: Update TestDPC storage ID"
   git push
   ```

---

## Step 2: Generate TestDPC QR Code

1. Go to https://bbtec-mdm.vercel.app/enrollment/qr-codes
2. Select **"Google Test DPC (for comparison)"** radio button
3. Select a policy
4. Click **"Generate Enrollment QR Code"**
5. QR code will show "DPC Version: 9.0.12 (TestDPC)"

---

## Step 3: Provision Device with TestDPC

1. Factory reset Android device
2. Tap 6 times on welcome screen
3. Scan the TestDPC QR code
4. Connect to WiFi
5. Wait for provisioning to complete

---

## Step 4: Verify Device Owner Status

```bash
adb shell dumpsys device_policy | grep -A5 "Device Owner"
```

**Expected if TestDPC works:**
```
Device Owner (User 0): com.afwsamples.testdpc
```

**If TestDPC shows Profile Owner:**
```
Profile Owner (User 10): com.afwsamples.testdpc
```

This would indicate the device/Android 10 version doesn't support Device Owner via QR provisioning.

---

## TestDPC Details

- **Package:** `com.afwsamples.testdpc`
- **Component:** `com.afwsamples.testdpc/com.afwsamples.testdpc.DeviceAdminReceiver`
- **Version:** 9.0.12
- **Signature Checksum:** `gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w`
- **Source:** [GitHub - android-testdpc](https://github.com/googlesamples/android-testdpc)

---

## Interpretation of Results

### TestDPC = Device Owner ✅
- **Device supports Device Owner mode**
- **Problem is in BBTec MDM APK** → Deep APK comparison needed

### TestDPC = Profile Owner ❌
- **Device/Android 10 doesn't support Device Owner via QR**
- **OR**: User accounts/device state preventing Device Owner
- **OR**: Manufacturer customization blocking Device Owner

---

**Next Steps:** See `DEVICE-OWNER-FAILURE-ANALYSIS.md` for complete investigation plan.
