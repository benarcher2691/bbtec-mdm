# bbtec-mdm Android Client

This is the Android client app that enables silent APK installation on managed devices.

## Features

- Automatic device registration with the bbtec-mdm server
- Periodic heartbeat polling (default: 15 minutes)
- Silent APK installation using Android's PackageInstaller API
- Background service for continuous monitoring
- Auto-start on device boot

## Prerequisites

- Android device enrolled in Android Enterprise (Device Owner mode)
- Android 10 (API 29) or higher
- Network connectivity to bbtec-mdm server

## Configuration

**IMPORTANT:** Before building the APK, you must update the server URL in the following files:

### 1. ApiClient.kt
```kotlin
// Line 17 - Replace with your Vercel deployment URL
private val baseUrl = "https://your-production-url.vercel.app/api/client"
```

### 2. DeviceRegistration.kt
```kotlin
// Line 29 - Replace with your Vercel deployment URL
.url("https://your-production-url.vercel.app/api/client/register")
```

## Building the APK

### Development Build (Debug)

```bash
cd android-client
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

### Production Build (Release)

**Note:** You'll need to create a signing key first.

#### Create Keystore (one-time)

```bash
keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bbtec-mdm
```

Keep `release-key.jks` secure and never commit it to version control!

#### Configure Signing in app/build.gradle.kts

Add the following before the `android` block:

```kotlin
android {
    // ... existing config ...

    signingConfigs {
        create("release") {
            storeFile = file("../release-key.jks")
            storePassword = "your_keystore_password"
            keyAlias = "bbtec-mdm"
            keyPassword = "your_key_password"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

#### Build Signed APK

```bash
./gradlew assembleRelease
```

Output: `app/build/outputs/apk/release/app-release.apk`

## Publishing to Google Play

### 1. Create Google Play Developer Account

- Visit: https://play.google.com/console/signup
- Cost: $25 one-time registration fee
- Complete developer profile

### 2. Create New App

- App name: **bbtec-mdm Client**
- Default language: English
- App type: Application
- Category: Business
- Free or Paid: Free

### 3. Upload APK to Internal Testing

1. Go to **Production** → **Internal testing**
2. Click **Create new release**
3. Upload `app-release.apk`
4. Add release notes
5. Review and publish

### 4. Note the Package Name

Your package name is: `com.bbtec.mdm.client`

### 5. Update Default Policy

After publishing, add the client app to your default policy so it auto-installs on enrolled devices.

Update `src/app/actions/android-management.ts`:

```typescript
applications: [
  {
    packageName: 'com.bbtec.mdm.client',
    installType: 'FORCE_INSTALLED',
    defaultPermissionPolicy: 'GRANT',
  },
  // ... other apps
]
```

Then call the policy update endpoint or function.

## Architecture

### Components

- **MainActivity.kt** - Main UI showing connection status
- **PollingService.kt** - Background service that polls for commands
- **ApkInstaller.kt** - Handles silent APK installation
- **ApiClient.kt** - HTTP client for server communication
- **DeviceRegistration.kt** - Device registration logic
- **PreferencesManager.kt** - Local settings storage
- **BootReceiver.kt** - Auto-start on boot
- **MdmDeviceAdminReceiver.kt** - Device admin callbacks

### Data Flow

1. Device boots → BootReceiver starts PollingService
2. PollingService sends heartbeat every 15 minutes
3. PollingService checks for pending commands
4. When install command found → ApkInstaller downloads and installs APK
5. InstallReceiver reports success/failure back to server

### API Endpoints Used

- `POST /api/client/register` - Register device on first launch
- `POST /api/client/heartbeat` - Send periodic heartbeat
- `GET /api/client/commands?deviceId={id}` - Get pending commands
- `POST /api/client/command-status` - Report command execution status

## Testing

### Local Testing (Before Publishing)

1. Build debug APK
2. Install on enrolled test device via adb:
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
3. Launch app to trigger registration
4. Monitor logs:
   ```bash
   adb logcat | grep -E "ApiClient|ApkInstaller|PollingService"
   ```

### Production Testing (After Publishing)

1. Enroll new device with QR code containing updated policy
2. Client app should auto-install
3. Check device detail view in web console for connection status
4. Queue an APK installation from web console
5. Wait up to 15 minutes for installation
6. Verify app installs silently

## Troubleshooting

### App Not Auto-Installing on Enrolled Devices

- Verify package name `com.bbtec.mdm.client` is in default policy
- Check policy has `FORCE_INSTALLED` install type
- Ensure policy was updated on Google servers (may take a few minutes)

### Connection Status Shows "Offline"

- Check device has internet connectivity
- Verify server URL is correct in ApiClient.kt and DeviceRegistration.kt
- Check API routes are deployed and accessible
- Review device logs for HTTP errors

### APK Installation Failing

- Ensure device is in Device Owner mode (required for silent install)
- Check APK download URL is publicly accessible
- Verify app has REQUEST_INSTALL_PACKAGES permission
- Review InstallReceiver logs for specific error messages

### Service Not Running After Boot

- Check RECEIVE_BOOT_COMPLETED permission is granted
- Verify BootReceiver is properly registered in AndroidManifest.xml
- Some devices may require manual app launch once before boot receiver works

## Development Notes

### Gradle Version

This project uses:
- Android Gradle Plugin 8.2.0
- Kotlin 1.9.20
- compileSdk 34
- minSdk 29 (Android 10)

### Dependencies

- AndroidX Core KTX 1.12.0
- AndroidX AppCompat 1.6.1
- Material Design 1.11.0
- OkHttp 4.12.0
- Gson 2.10.1
- WorkManager 2.9.0

## Security Considerations

- Never hardcode API keys or secrets in the app
- All communication should be over HTTPS
- Device ID uses Android's ANDROID_ID (unique per device, per app)
- APK downloads should be from trusted sources only

## License

This project is part of the bbtec-mdm system.
