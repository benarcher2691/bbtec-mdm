# Private APK Installation Solution

## Problem
Need to silently install private APKs on managed devices without:
- Google Play publishing
- Managed Google Play workflow
- User interaction

## Solution: MDM Helper App

### Architecture

```
┌─────────────────────────────────────────────────┐
│  bbtec-mdm Web Console                          │
│  - Upload APK                                   │
│  - Click "Push to Device"                       │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Server (Convex + Next.js)                      │
│  - Store APK                                    │
│  - Generate download URL                        │
│  - Send command to device via FCM/polling       │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Managed Device                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ bbtec-mdm Helper App (Device Owner)       │ │
│  │ - Receives install commands               │ │
│  │ - Downloads APK from URL                  │ │
│  │ - Silently installs using PackageInstaller│ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Step-by-Step Implementation

#### Phase 1: Create Helper Android App

**File: `android-helper-app/app/src/main/java/com/bbtec/mdm/helper/`**

```kotlin
// MainActivity.kt
class HelperService : Service() {

    // Listen for install commands via FCM or polling
    private fun installApk(downloadUrl: String, packageName: String) {
        // 1. Download APK
        val apkFile = downloadApk(downloadUrl)

        // 2. Install using PackageInstaller (Device Owner privilege)
        val packageInstaller = packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(
            PackageInstaller.SessionParams.MODE_FULL_INSTALL
        )

        val sessionId = packageInstaller.createSession(params)
        val session = packageInstaller.openSession(sessionId)

        // Write APK to session
        session.openWrite(packageName, 0, -1).use { output ->
            apkFile.inputStream().use { input ->
                input.copyTo(output)
            }
        }

        // Commit session - this installs silently in Device Owner mode
        val intent = Intent(this, InstallReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            this, sessionId, intent, PendingIntent.FLAG_UPDATE_CURRENT
        )
        session.commit(pendingIntent.intentSender)
    }
}
```

**File: `AndroidManifest.xml`**
```xml
<manifest>
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>
    <uses-permission android:name="android.permission.INTERNET"/>

    <application>
        <service android:name=".HelperService" android:exported="true"/>
    </application>
</manifest>
```

#### Phase 2: Publish Helper App

1. Create Google Play Developer account (one-time, ~$25)
2. Publish "bbtec-mdm Helper" as **unlisted app**
3. Note the package name: `com.bbtec.mdm.helper`

#### Phase 3: Update Default Policy

```typescript
// src/app/actions/android-management.ts
const defaultPolicy = {
  applications: [
    {
      packageName: 'com.bbtec.mdm.helper',
      installType: 'FORCE_INSTALLED',  // Auto-install on all devices
      defaultPermissionPolicy: 'GRANT',  // Auto-grant all permissions
    },
  ],
  // ... rest of policy
}
```

#### Phase 4: Create Command System

**File: `convex/install-commands.ts`**
```typescript
// Queue system for installation commands
export const queueInstall = mutation({
  args: {
    deviceId: v.string(),
    apkUrl: v.string(),
    packageName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("installQueue", {
      deviceId: args.deviceId,
      apkUrl: args.apkUrl,
      packageName: args.packageName,
      status: "pending",
      createdAt: Date.now(),
    })
  },
})
```

**File: `src/app/api/commands/route.ts`**
```typescript
// Device polls this endpoint for commands
export async function GET(request: NextRequest) {
  const deviceId = request.headers.get('X-Device-ID')

  // Get pending install commands for this device
  const commands = await convex.query(api.installCommands.getPending, {
    deviceId,
  })

  return NextResponse.json({ commands })
}
```

#### Phase 5: Update Install Flow

```typescript
// src/app/actions/android-management.ts
export async function installAppOnDevice(
  deviceId: string,
  packageName: string,
  downloadUrl: string
) {
  // Instead of updating policy, send command to helper app
  await queueInstallCommand({
    deviceId,
    apkUrl: downloadUrl,
    packageName,
  })

  return {
    success: true,
    message: 'Installation command sent. App will install within 1-2 minutes.',
  }
}
```

### How It Works

1. **Device enrolled** → Helper app automatically installed
2. **Helper app starts** → Registers device ID, starts polling for commands
3. **Admin uploads APK** → Stored in Convex
4. **Admin clicks "Install"** → Creates command in queue
5. **Helper app polls** → Sees command, downloads APK
6. **Helper installs silently** → Using Device Owner privileges
7. **App appears on device** → No user interaction needed!

### Advantages

✅ True silent installation (no user taps)
✅ Works with any private APK
✅ No Google Play publishing of private apps
✅ Only ONE app needs Google Play (the helper)
✅ Full control over installation process

### Limitations

⚠️ Requires publishing ONE helper app to Google Play (one-time)
⚠️ Devices need internet to poll for commands
⚠️ Installation takes 1-2 minutes (polling interval)

### Alternative: FCM Push Instead of Polling

Use Firebase Cloud Messaging for instant delivery:

```typescript
// When admin clicks install
await sendFCMMessage({
  to: deviceToken,
  data: {
    action: 'install_apk',
    downloadUrl: apkUrl,
    packageName: packageName,
  },
})
```

This makes installation **instant** instead of waiting for poll.

---

## Decision Points

**Option A: Helper App (Recommended)**
- ✅ True silent installation
- ✅ Professional solution
- ⚠️ Requires one app in Play Store
- ⚠️ 2-3 days development time

**Option B: Advanced WebApps Approach**
- Use webApps + installUnknownSourcesAllowed
- Might trigger automatic installation in some scenarios
- ⚠️ Not guaranteed to work
- ⚠️ May still require user tap

**Option C: Custom ROM/OEM Partnership**
- Partner with device manufacturer
- Get OEM-level installation APIs
- ⚠️ Only works with specific devices
- ⚠️ Very complex

---

## Recommendation

**Implement Option A: Helper App**

This is exactly how enterprise MDM solutions work. The helper app:
- Is published ONCE (unlisted, doesn't appear in search)
- Auto-installed on all managed devices
- Handles ALL private APK installations
- Provides true silent installation

**Timeline:**
- Day 1: Build Android helper app (6-8 hours)
- Day 2: Publish to Play Store + integrate backend (6-8 hours)
- Day 3: Testing and refinement (4-6 hours)

**Total: 2-3 days** to have working silent installation of private APKs.

This is the **only way** to achieve what Miradore does without using managed Play for every APK.
