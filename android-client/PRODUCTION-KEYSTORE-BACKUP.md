# Production Keystore Backup Instructions

## ⚠️  CRITICAL: NEVER LOSE THE PRODUCTION KEYSTORE

**If you lose the production keystore, you CANNOT update any published apps.**

## What Was Created

**Date:** 2025-11-13
**File:** `bbtec-mdm-PRODUCTION.keystore`
**Alias:** `bbtec-mdm-prod`
**Valid until:** 2053-03-31 (27 years)
**Certificate SHA256:** `8F:BC:3A:E9:1D:5F:FC:60:18:7D:B4:89:A7:9D:B3:21:34:BF:48:B3:8A:24:C7:C6:AB:BC:AE:37:4B:A8:68:61`

## Backup Status

✅ **Primary backup:** GNU pass (encrypted)
- `pass show bbtec/bbtec-mdm/android/keystore_file_PRODUCTION`
- `pass show bbtec/bbtec-mdm/android/keystore_properties_PRODUCTION`

❌ **Offline backup:** NOT YET CREATED (DO THIS NOW!)

## Create Offline Backup (DO THIS IMMEDIATELY)

### Option 1: USB Drive Backup (Recommended)

```bash
# 1. Insert USB drive
# 2. Export keystore and credentials
cd /home/ben/sandbox/bbtec-mdm/android-client
mkdir -p /media/usb/bbtec-mdm-backup-$(date +%Y%m%d)
cp bbtec-mdm-PRODUCTION.keystore /media/usb/bbtec-mdm-backup-$(date +%Y%m%d)/
pass show bbtec/bbtec-mdm/android/keystore_properties_PRODUCTION > /media/usb/bbtec-mdm-backup-$(date +%Y%m%d)/keystore-credentials.txt

# 3. Write certificate fingerprint for verification
echo "SHA256: 8F:BC:3A:E9:1D:5F:FC:60:18:7D:B4:89:A7:9D:B3:21:34:BF:48:B3:8A:24:C7:C6:AB:BC:AE:37:4B:A8:68:61" \
  > /media/usb/bbtec-mdm-backup-$(date +%Y%m%d)/FINGERPRINT.txt

# 4. Verify backup
keytool -list -v -keystore /media/usb/bbtec-mdm-backup-$(date +%Y%m%d)/bbtec-mdm-PRODUCTION.keystore

# 5. Unmount USB drive and store in safe location
```

**Store USB drive in:** 🏠 Safe, security deposit box, or locked drawer (separate from computer)

### Option 2: Paper Backup (Paranoid Mode)

```bash
# Export as QR code (can be scanned back)
pass show bbtec/bbtec-mdm/android/keystore_file_PRODUCTION | grep -v "^#" | qrencode -o keystore-qr.png

# Or print as text
pass show bbtec/bbtec-mdm/android/keystore_properties_PRODUCTION | lpr
```

### Option 3: Cloud Backup (Encrypted)

```bash
# Export encrypted with GPG (already done by pass)
cd ~/.password-store/bbtec/bbtec-mdm/android/
cp keystore_file_PRODUCTION.gpg ~/Dropbox/secure-backups/
cp keystore_properties_PRODUCTION.gpg ~/Dropbox/secure-backups/
```

⚠️  **Only upload if you trust the cloud provider and encryption**

## Restore Production Keystore

### From GNU pass (Primary Method)

```bash
cd /home/ben/sandbox/bbtec-mdm/android-client

# Restore keystore file
pass show bbtec/bbtec-mdm/android/keystore_file_PRODUCTION | \
  grep -v "^#" | grep -v "^$" | base64 -d > bbtec-mdm-PRODUCTION.keystore

# Restore properties
pass show bbtec/bbtec-mdm/android/keystore_properties_PRODUCTION | \
  tail -n +21 > keystore.properties.production

# Verify integrity
keytool -list -v -keystore bbtec-mdm-PRODUCTION.keystore \
  -storepass "$(grep storePassword keystore.properties.production | cut -d= -f2)"
```

### From USB Backup

```bash
cp /media/usb/bbtec-mdm-backup-YYYYMMDD/bbtec-mdm-PRODUCTION.keystore ./
cp /media/usb/bbtec-mdm-backup-YYYYMMDD/keystore-credentials.txt ./
```

## Using Production Keystore

### Update Gradle Build Configuration

Edit `android-client/app/build.gradle.kts`:

```kotlin
signingConfigs {
    create("production") {
        storeFile = file("../bbtec-mdm-PRODUCTION.keystore")
        storePassword = keystoreProperties.getProperty("storePassword")
        keyAlias = "bbtec-mdm-prod"
        keyPassword = keystoreProperties.getProperty("keyPassword")
        enableV1Signing = true
        enableV2Signing = true
    }
}

buildTypes {
    release {
        signingConfig = signingConfigs.getByName("production")
    }
}
```

### Build Production APK

```bash
cd android-client

# Copy production credentials
cp keystore.properties.production keystore.properties

# Build production release
./gradlew assembleProductionRelease

# Verify signature
/opt/android-sdk/build-tools/34.0.0/apksigner verify --print-certs \
  app/build/outputs/apk/production/release/app-production-release.apk

# Should show:
# SHA-256: 8F:BC:3A:E9:1D:5F:FC:60:18:7D:B4:89:A7:9D:B3:21:34:BF:48:B3:8A:24:C7:C6:AB:BC:AE:37:4B:A8:68:61
```

## Security Checklist

Before using production keystore in CI/CD or sharing with team:

- [ ] Created offline USB backup
- [ ] Verified backup can be restored
- [ ] Stored USB in secure location (not near computer)
- [ ] Documented backup location (tell someone trusted)
- [ ] Added `bbtec-mdm-PRODUCTION.keystore` to `.gitignore` (already done)
- [ ] Never committed production keystore to git
- [ ] Never shared passwords in plain text (use pass or encrypted channel)
- [ ] Tested building and signing with production keystore
- [ ] Verified certificate fingerprint matches

## Google Play Signing (Future)

When publishing to Google Play Store:

1. **Option A (Recommended):** Use Google Play App Signing
   - Upload production APK signed with this keystore
   - Google manages the distribution certificate
   - You keep this keystore for local builds

2. **Option B:** Manual signing
   - Always use this production keystore for Play Store uploads
   - Keep offline backups (Google won't help if you lose it)

## Emergency Contact

If production keystore is lost:

1. **Cannot update existing apps** - Users must uninstall and reinstall
2. **Cannot migrate to new certificate** - Breaks app updates
3. **Must generate new keystore** - Effectively a new app
4. **Lose all existing users** - They won't receive updates

**THIS IS WHY BACKUPS ARE CRITICAL!**

---

**Last Updated:** 2025-11-13
**Next Backup Check:** 2025-12-13 (monthly reminder)
