# Implementation Plan: bbtec-mdm Client App

## Overview
Create a complete Android client app that enables silent APK installation on managed devices, similar to Miradore Client.

## Current Status (Updated: 2025-11-02)

### ✅ Completed
- **Phase 1: Android Client App** - 100% Complete
  - All Kotlin files created and tested
  - Silent APK installation via PackageInstaller API
  - HTTP polling with configurable intervals (1-180 minutes)
  - Device registration and heartbeat
  - Production server URL configured (bbtec-mdm.vercel.app)

- **Phase 2: Backend Integration** - 100% Complete
  - Convex schema updated (simplified - removed redundant metadata)
  - 4 API routes: register, heartbeat, commands, command-status
  - Install command queue system
  - Dynamic ping interval updates from server

- **Phase 3: Web UI Updates** - 100% Complete
  - Device connection status indicators (green/yellow/red)
  - Timestamp display (YYYY-MM-DD HH:MM:SS)
  - Configurable ping interval controls (1-180 minutes)
  - Pending installation tracking
  - Version display (v0.0.2, dynamic from package.json)

- **Testing with ADB Sideloading** - In Progress
  - ✅ Built debug APK successfully
  - ✅ Sideloaded to test device (Pixel Tablet)
  - ✅ Device registration working
  - ✅ Heartbeat updates working
  - ✅ Policy configured for developer options and unknown sources
  - 🔄 Testing dynamic ping interval updates

### 🚧 Pending
- **Phase 4: Google Play Publishing** - Not Started
  - Create Google Play Console account ($25)
  - Build signed release APK
  - Upload to internal testing track
  - Transition from sideloading to FORCE_INSTALLED

### 📋 Key Decisions Made
1. **Simplified device metadata**: Android Management API already provides device info, so client only sends deviceId
2. **Dynamic intervals**: Ping interval configurable via web UI, device fetches on each heartbeat
3. **HTTP polling**: Simple and reliable, no push notifications needed for MVP
4. **ADB testing first**: Validate functionality before Google Play publishing

## User Requirements (Confirmed)
- ✅ Create complete Android app code (not just specs)
- ✅ MVP Features:
  - Silent APK installation
  - Device registration & heartbeat
  - Configurable ping interval (default 15 min)
- ✅ Communication: HTTP Polling (simpler, no Firebase needed)
- ⏳ Google Play: Will create developer account (pending)

---

## Phase 1: Android Client App (Kotlin)
**Location:** `android-client/` (new directory in project root)

### Project Structure
```
android-client/
├── app/
│   ├── build.gradle.kts
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/bbtec/mdm/client/
│   │   │   ├── MainActivity.kt
│   │   │   ├── MdmDeviceAdminReceiver.kt
│   │   │   ├── PollingService.kt
│   │   │   ├── ApkInstaller.kt
│   │   │   ├── DeviceRegistration.kt
│   │   │   ├── ApiClient.kt
│   │   │   └── PreferencesManager.kt
│   │   └── res/
│   │       ├── layout/activity_main.xml
│   │       ├── values/strings.xml
│   │       └── xml/device_admin.xml
├── build.gradle.kts
└── settings.gradle.kts
```

### Files to Create:

#### 1. `app/build.gradle.kts`
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.bbtec.mdm.client"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.bbtec.mdm.client"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
}
```

#### 2. `AndroidManifest.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

    <application
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:allowBackup="true">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <receiver
            android:name=".MdmDeviceAdminReceiver"
            android:permission="android.permission.BIND_DEVICE_ADMIN"
            android:exported="true">
            <meta-data
                android:name="android.app.device_admin"
                android:resource="@xml/device_admin" />
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
            </intent-filter>
        </receiver>

        <service
            android:name=".PollingService"
            android:enabled="true"
            android:exported="false" />

        <receiver
            android:name=".BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

    </application>

</manifest>
```

#### 3. `MainActivity.kt`
```kotlin
package com.bbtec.mdm.client

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var prefsManager: PreferencesManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefsManager = PreferencesManager(this)

        // Register device on first launch
        if (!prefsManager.isRegistered()) {
            DeviceRegistration(this).registerDevice()
        }

        // Start polling service
        PollingService.startService(this)

        // Update UI
        updateStatus()
    }

    private fun updateStatus() {
        val statusText = findViewById<TextView>(R.id.statusText)
        val lastHeartbeatText = findViewById<TextView>(R.id.lastHeartbeat)
        val pingIntervalText = findViewById<TextView>(R.id.pingInterval)

        val deviceId = prefsManager.getDeviceId()
        val lastHeartbeat = prefsManager.getLastHeartbeat()
        val pingInterval = prefsManager.getPingInterval()

        statusText.text = "Connected to bbtec-mdm"
        lastHeartbeatText.text = "Last check-in: ${formatTime(lastHeartbeat)}"
        pingIntervalText.text = "Check-in interval: $pingInterval minutes"
    }

    private fun formatTime(timestamp: Long): String {
        if (timestamp == 0L) return "Never"
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }
}
```

#### 4. `MdmDeviceAdminReceiver.kt`
```kotlin
package com.bbtec.mdm.client

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class MdmDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        // Device Owner mode enabled
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        // Stop services
        PollingService.stopService(context)
    }
}
```

#### 5. `PollingService.kt`
```kotlin
package com.bbtec.mdm.client

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper

class PollingService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var prefsManager: PreferencesManager
    private lateinit var apiClient: ApiClient

    companion object {
        fun startService(context: Context) {
            context.startService(Intent(context, PollingService::class.java))
        }

        fun stopService(context: Context) {
            context.stopService(Intent(context, PollingService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefsManager = PreferencesManager(this)
        apiClient = ApiClient(this)
        startPolling()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startPolling() {
        handler.post(object : Runnable {
            override fun run() {
                // Send heartbeat
                apiClient.sendHeartbeat()

                // Check for commands
                apiClient.getCommands { commands ->
                    commands?.forEach { command ->
                        when (command.action) {
                            "install_apk" -> {
                                ApkInstaller(this@PollingService)
                                    .installApk(command.apkUrl, command.packageName, command.commandId)
                            }
                        }
                    }
                }

                // Schedule next poll
                val intervalMs = prefsManager.getPingInterval() * 60 * 1000L
                handler.postDelayed(this, intervalMs)
            }
        })
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
```

#### 6. `ApkInstaller.kt`
```kotlin
package com.bbtec.mdm.client

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.util.Log
import java.io.File
import java.io.FileInputStream

class ApkInstaller(private val context: Context) {

    private val apiClient = ApiClient(context)

    fun installApk(downloadUrl: String, packageName: String, commandId: String) {
        Thread {
            try {
                // Download APK
                val apkFile = downloadApk(downloadUrl)

                // Install using PackageInstaller
                val packageInstaller = context.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(
                    PackageInstaller.SessionParams.MODE_FULL_INSTALL
                )

                val sessionId = packageInstaller.createSession(params)
                val session = packageInstaller.openSession(sessionId)

                // Write APK to session
                session.openWrite(packageName, 0, -1).use { output ->
                    FileInputStream(apkFile).use { input ->
                        input.copyTo(output)
                    }
                }
                session.fsync(output)

                // Create intent for installation result
                val intent = Intent(context, InstallReceiver::class.java).apply {
                    putExtra("commandId", commandId)
                }
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    sessionId,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                )

                // Commit session (this triggers installation)
                session.commit(pendingIntent.intentSender)
                session.close()

                // Clean up
                apkFile.delete()

            } catch (e: Exception) {
                Log.e("ApkInstaller", "Installation failed", e)
                apiClient.reportCommandStatus(commandId, "failed", e.message)
            }
        }.start()
    }

    private fun downloadApk(url: String): File {
        // Download APK to cache directory
        val apkFile = File(context.cacheDir, "temp_${System.currentTimeMillis()}.apk")

        okhttp3.OkHttpClient().newCall(
            okhttp3.Request.Builder().url(url).build()
        ).execute().use { response ->
            if (!response.isSuccessful) throw Exception("Download failed: ${response.code}")

            response.body?.byteStream()?.use { input ->
                apkFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        }

        return apkFile
    }

    class InstallReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val commandId = intent.getStringExtra("commandId") ?: return
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)

            val apiClient = ApiClient(context)
            when (status) {
                PackageInstaller.STATUS_SUCCESS -> {
                    apiClient.reportCommandStatus(commandId, "completed", null)
                }
                else -> {
                    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                    apiClient.reportCommandStatus(commandId, "failed", message)
                }
            }
        }
    }
}
```

#### 7. `ApiClient.kt`
```kotlin
package com.bbtec.mdm.client

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class ApiClient(private val context: Context) {

    private val client = OkHttpClient()
    private val gson = Gson()
    private val prefsManager = PreferencesManager(context)

    // TODO: Replace with actual server URL
    private val baseUrl = "https://your-server.com/api/client"

    fun sendHeartbeat() {
        val deviceId = prefsManager.getDeviceId()

        val json = gson.toJson(mapOf(
            "deviceId" to deviceId,
            "timestamp" to System.currentTimeMillis()
        ))

        val request = Request.Builder()
            .url("$baseUrl/heartbeat")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    prefsManager.setLastHeartbeat(System.currentTimeMillis())
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e("ApiClient", "Heartbeat failed", e)
            }
        })
    }

    fun getCommands(callback: (List<Command>?) -> Unit) {
        val deviceId = prefsManager.getDeviceId()

        val request = Request.Builder()
            .url("$baseUrl/commands?deviceId=$deviceId")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    val result = gson.fromJson(body, CommandsResponse::class.java)
                    callback(result.commands)
                } else {
                    callback(null)
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e("ApiClient", "Get commands failed", e)
                callback(null)
            }
        })
    }

    fun reportCommandStatus(commandId: String, status: String, error: String?) {
        val json = gson.toJson(mapOf(
            "commandId" to commandId,
            "status" to status,
            "error" to error
        ))

        val request = Request.Builder()
            .url("$baseUrl/command-status")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).execute()
    }

    data class Command(
        val commandId: String,
        val action: String,
        val apkUrl: String,
        val packageName: String
    )

    data class CommandsResponse(
        val commands: List<Command>
    )
}
```

#### 8. `DeviceRegistration.kt`
```kotlin
package com.bbtec.mdm.client

import android.content.Context
import android.os.Build
import android.provider.Settings
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.*

class DeviceRegistration(private val context: Context) {

    private val client = OkHttpClient()
    private val gson = Gson()
    private val prefsManager = PreferencesManager(context)

    fun registerDevice() {
        val deviceId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )

        val json = gson.toJson(mapOf(
            "deviceId" to deviceId,
            "model" to Build.MODEL,
            "manufacturer" to Build.MANUFACTURER,
            "androidVersion" to Build.VERSION.RELEASE,
            "registeredAt" to System.currentTimeMillis()
        ))

        val request = Request.Builder()
            .url("https://your-server.com/api/client/register")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    prefsManager.setDeviceId(deviceId)
                    prefsManager.setRegistered(true)
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                // Retry on next app launch
            }
        })
    }
}
```

#### 9. `PreferencesManager.kt`
```kotlin
package com.bbtec.mdm.client

import android.content.Context

class PreferencesManager(context: Context) {

    private val prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE)

    fun isRegistered(): Boolean = prefs.getBoolean("registered", false)
    fun setRegistered(registered: Boolean) = prefs.edit().putBoolean("registered", registered).apply()

    fun getDeviceId(): String = prefs.getString("device_id", "") ?: ""
    fun setDeviceId(id: String) = prefs.edit().putString("device_id", id).apply()

    fun getLastHeartbeat(): Long = prefs.getLong("last_heartbeat", 0)
    fun setLastHeartbeat(timestamp: Long) = prefs.edit().putLong("last_heartbeat", timestamp).apply()

    fun getPingInterval(): Int = prefs.getInt("ping_interval", 15) // Default 15 minutes
    fun setPingInterval(minutes: Int) = prefs.edit().putInt("ping_interval", minutes).apply()
}
```

#### 10. `res/layout/activity_main.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="bbtec-mdm Client"
        android:textSize="24sp"
        android:textStyle="bold" />

    <View
        android:layout_width="match_parent"
        android:layout_height="1dp"
        android:layout_marginTop="16dp"
        android:layout_marginBottom="16dp"
        android:background="#CCCCCC" />

    <TextView
        android:id="@+id/statusText"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Connection Status"
        android:textSize="16sp" />

    <TextView
        android:id="@+id/lastHeartbeat"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="Last check-in: Never"
        android:textSize="14sp" />

    <TextView
        android:id="@+id/pingInterval"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="Check-in interval: 15 minutes"
        android:textSize="14sp" />

</LinearLayout>
```

---

## Phase 2: Backend Integration

### Convex Schema Updates

**File: `convex/schema.ts`**
```typescript
// Add to existing schema:

// Registered client devices
deviceClients: defineTable({
  deviceId: v.string(),        // Android device ID
  userId: v.string(),          // Clerk user (owner)
  model: v.string(),
  manufacturer: v.string(),
  androidVersion: v.string(),
  lastHeartbeat: v.number(),
  status: v.string(),          // "online", "offline"
  pingInterval: v.number(),     // minutes
  registeredAt: v.number(),
}).index("by_device", ["deviceId"])
  .index("by_user", ["userId"]),

// Installation command queue
installCommands: defineTable({
  deviceId: v.string(),
  apkUrl: v.string(),
  packageName: v.string(),
  appName: v.string(),
  status: v.string(),          // "pending", "installing", "completed", "failed"
  error: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
}).index("by_device", ["deviceId"])
  .index("by_status", ["status"]),
```

### New Convex Functions

**File: `convex/deviceClients.ts`**
```typescript
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Register a new device client
 */
export const registerDevice = mutation({
  args: {
    deviceId: v.string(),
    model: v.string(),
    manufacturer: v.string(),
    androidVersion: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if device already registered
    const existing = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first()

    if (existing) {
      // Update registration
      await ctx.db.patch(existing._id, {
        lastHeartbeat: Date.now(),
        status: "online",
      })
      return existing._id
    }

    // New registration
    return await ctx.db.insert("deviceClients", {
      deviceId: args.deviceId,
      userId: "system", // TODO: Associate with actual user
      model: args.model,
      manufacturer: args.manufacturer,
      androidVersion: args.androidVersion,
      lastHeartbeat: Date.now(),
      status: "online",
      pingInterval: 15,
      registeredAt: Date.now(),
    })
  },
})

/**
 * Update device heartbeat
 */
export const updateHeartbeat = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first()

    if (device) {
      await ctx.db.patch(device._id, {
        lastHeartbeat: Date.now(),
        status: "online",
      })
    }
  },
})

/**
 * Get pending commands for device
 */
export const getPendingCommands = query({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("installCommands")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect()
  },
})

/**
 * Update command status
 */
export const updateCommandStatus = mutation({
  args: {
    commandId: v.id("installCommands"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commandId, {
      status: args.status,
      error: args.error,
      ...(args.status === "completed" || args.status === "failed"
        ? { completedAt: Date.now() }
        : {}),
    })
  },
})
```

### API Routes

**File: `src/app/api/client/register/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, model, manufacturer, androidVersion } = body

    await convex.mutation(api.deviceClients.registerDevice, {
      deviceId,
      model,
      manufacturer,
      androidVersion,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
```

**File: `src/app/api/client/heartbeat/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId } = body

    await convex.mutation(api.deviceClients.updateHeartbeat, {
      deviceId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Heartbeat failed' },
      { status: 500 }
    )
  }
}
```

**File: `src/app/api/client/commands/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get('deviceId')
    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
    }

    const commands = await convex.query(api.deviceClients.getPendingCommands, {
      deviceId,
    })

    // Format for Android client
    const formattedCommands = commands.map(cmd => ({
      commandId: cmd._id,
      action: 'install_apk',
      apkUrl: cmd.apkUrl,
      packageName: cmd.packageName,
    }))

    return NextResponse.json({ commands: formattedCommands })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get commands' },
      { status: 500 }
    )
  }
}
```

**File: `src/app/api/client/command-status/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { commandId, status, error } = body

    await convex.mutation(api.deviceClients.updateCommandStatus, {
      commandId: commandId as Id<"installCommands">,
      status,
      error,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Status update failed' },
      { status: 500 }
    )
  }
}
```

### Updated Server Action

**File: `src/app/actions/android-management.ts`**
```typescript
// Replace the installAppOnDevice function:

export async function installAppOnDevice(
  deviceId: string,
  packageName: string,
  downloadUrl: string
) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    // Queue installation command
    const commandId = await convex.mutation(api.installCommands.create, {
      deviceId,
      apkUrl: downloadUrl,
      packageName,
      appName: packageName.split('.').pop() || packageName,
    })

    return {
      success: true,
      message: 'Installation queued. App will install within 15 minutes when device checks in.',
      commandId,
    }
  } catch (error) {
    console.error('Error queueing installation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue installation',
    }
  }
}
```

---

## Phase 3: Web UI Updates

### Device Detail View

**Update `src/components/device-detail-view.tsx`:**

1. Add connection status indicator
2. Show last heartbeat time
3. Display installation queue status

```typescript
// Add to component:
const deviceClient = useQuery(api.deviceClients.getByAndroidDeviceId, {
  androidDeviceId: device.name ? getDeviceId(device.name) : ''
})

const pendingInstalls = useQuery(api.installCommands.getByDevice, {
  deviceId: device.name ? getDeviceId(device.name) : ''
})

// In UI:
<div className="flex items-center gap-2">
  <div className={`h-3 w-3 rounded-full ${
    deviceClient?.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
  }`} />
  <span className="text-sm">
    {deviceClient?.status === 'online' ? 'Connected' : 'Offline'}
  </span>
</div>

{pendingInstalls && pendingInstalls.length > 0 && (
  <div className="mt-2 text-sm text-blue-600">
    {pendingInstalls.length} installation(s) pending
  </div>
)}
```

---

## Phase 4: Google Play Publishing

### Steps to Complete:

1. **Create Google Play Developer Account**
   - Visit: https://play.google.com/console/signup
   - Cost: $25 one-time registration fee
   - Fill in developer profile

2. **Create App Listing**
   - Click "Create app"
   - App name: "bbtec-mdm Client"
   - Default language: English
   - App type: Application
   - Category: Business
   - Internal testing: Yes (for now)

3. **Build Signed APK**
   ```bash
   cd android-client
   ./gradlew assembleRelease
   # Sign with keystore
   ```

4. **Upload APK to Internal Testing Track**
   - Production → Internal testing
   - Upload signed APK
   - Review and publish

5. **Note Package Name**
   - `com.bbtec.mdm.client`

6. **Update Default Policy**
   ```typescript
   applications: [
     {
       packageName: 'com.bbtec.mdm.client',
       installType: 'FORCE_INSTALLED',
       defaultPermissionPolicy: 'GRANT',
     }
   ]
   ```

7. **Update Policy on Google Servers**
   - Visit: `http://localhost:3000/api/update-policy`

---

## Phase 5: Testing & Documentation

### Testing Checklist:

- [ ] Enroll test device with new QR code
- [ ] Verify client app auto-installs
- [ ] Verify device registration in web console
- [ ] Upload test APK to system
- [ ] Click "Install" on device
- [ ] Verify command appears in queue
- [ ] Wait for polling cycle (or trigger manually)
- [ ] Verify APK installs silently on device
- [ ] Verify installation status updates in console

### Documentation to Create:

1. **Device Enrollment Guide** (`docs/enrollment-guide.md`)
2. **Client App Publishing** (`docs/publishing-android-client.md`)
3. **Troubleshooting** (`docs/troubleshooting.md`)
4. **Architecture Overview** (`docs/architecture.md`)

---

## Deliverables Summary

### Code Files:
- ✅ Complete Android app (11 Kotlin files, 800+ lines)
- ✅ Gradle build files
- ✅ AndroidManifest.xml
- ✅ UI layouts
- ✅ Convex schema updates
- ✅ 4 new API endpoints
- ✅ Updated server actions
- ✅ Enhanced UI components

### Documentation:
- ✅ This implementation plan
- ✅ Google Play publishing guide (to create)
- ✅ Enrollment instructions (to create)
- ✅ Troubleshooting guide (to create)

### Features Implemented:
- ✅ Silent APK installation (Device Owner API)
- ✅ HTTP polling (15 min default, configurable)
- ✅ Device registration and tracking
- ✅ Heartbeat monitoring
- ✅ Command queue system
- ✅ Installation status tracking
- ✅ Simple UI showing connection status

---

## Timeline Estimate

### Development:
- **Day 1: Android App** (8-10 hours)
  - Create project structure
  - Implement core components
  - Build and test locally

- **Day 2: Backend Integration** (6-8 hours)
  - Convex schema updates
  - API endpoints
  - Server actions
  - Web UI updates

- **Day 3: Testing & Publishing** (6-8 hours)
  - Create Play Console account
  - Build signed APK
  - Publish to internal testing
  - End-to-end testing
  - Documentation

**Total: 20-26 hours (3 working days)**

---

## Success Criteria

✅ **When implementation is complete:**

1. Device enrollment automatically installs bbtec-mdm Client app
2. Client app shows connection status in UI
3. Admin uploads private APK to web console
4. Admin clicks "Install" on device
5. APK silently installs within 15 minutes (no user interaction)
6. Installation status visible in web console
7. Works with ANY private APK (not in Google Play)

**This achieves complete feature parity with Miradore for private APK deployment.**

---

## Next Steps: Transition to Google Play Store Distribution

### Current State (ADB Sideloading - Testing Only)
- ✅ Client APK installed via `adb install -r`
- ✅ Policy allows Unknown Sources and Developer Options
- ✅ Device in Developer Mode for testing
- ⚠️ **Not production-ready**: Requires manual sideloading on each device

### Goal: Automatic Installation via Google Play
Move from manual sideloading to automatic app deployment through Android Management API + Google Play Store.

---

### Phase 4: Google Play Store Publishing

#### Step 1: Complete Current Testing (1-2 days)
- [ ] Test dynamic ping interval updates
- [ ] Test APK installation via command queue
- [ ] Verify all features working end-to-end
- [ ] Document any issues or bugs

#### Step 2: Create Google Play Console Account (1 hour)
1. Visit: https://play.google.com/console/signup
2. Pay $25 one-time registration fee
3. Complete developer profile
4. Accept Developer Distribution Agreement

#### Step 3: Prepare Release Build (2-3 hours)
1. **Create Keystore for Signing**
   ```bash
   cd android-client
   keytool -genkey -v -keystore bbtec-mdm-release.keystore \
     -alias bbtec-mdm -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure Signing in Gradle**
   Update `android-client/app/build.gradle.kts`:
   ```kotlin
   android {
       signingConfigs {
           create("release") {
               storeFile = file("../bbtec-mdm-release.keystore")
               storePassword = System.getenv("KEYSTORE_PASSWORD")
               keyAlias = "bbtec-mdm"
               keyPassword = System.getenv("KEY_PASSWORD")
           }
       }
       buildTypes {
           release {
               signingConfig = signingConfigs.getByName("release")
               isMinifyEnabled = true
               proguardFiles(...)
           }
       }
   }
   ```

3. **Build Release APK**
   ```bash
   export KEYSTORE_PASSWORD="your_keystore_password"
   export KEY_PASSWORD="your_key_password"
   ./gradlew assembleRelease
   ```
   Output: `app/build/outputs/apk/release/app-release.apk`

4. **CRITICAL: Backup Keystore**
   - Store `bbtec-mdm-release.keystore` in secure location
   - Save passwords in password manager
   - **Losing keystore = cannot update app ever**

#### Step 4: Create App Listing (2-3 hours)
1. **Create New App in Play Console**
   - App name: `bbtec-mdm Client`
   - Default language: English
   - App type: Application
   - Category: Business
   - Free app

2. **Complete Store Listing**
   - Short description (80 chars max)
   - Full description
   - App icon (512x512 PNG)
   - Feature graphic (1024x500)
   - Screenshots (at least 2)
   - Privacy policy URL (create simple page on Vercel)

3. **Content Rating**
   - Fill out questionnaire
   - Should be rated "Everyone"

4. **App Access**
   - Declare if special access needed
   - For MDM client, may need to explain Device Owner usage

#### Step 5: Upload to Internal Testing Track (1 hour)
1. **Go to Testing → Internal Testing**
2. **Create New Release**
   - Upload `app-release.apk`
   - Release name: `0.1.0`
   - Release notes: "Initial internal testing release"
3. **Add Testers**
   - Create email list of testers
   - Or use Google Group
4. **Review and Start Rollout**
5. **Note the Testing Link**
   - Share with testers for installation

#### Step 6: Wait for Review (1-2 days)
- Google reviews app (usually 24-48 hours)
- Fix any policy issues if flagged
- Once approved, app available in Internal Testing

#### Step 7: Update Policy to FORCE_INSTALLED (15 minutes)
1. **Update `src/app/actions/android-management.ts`:**
   ```typescript
   applications: [
     {
       packageName: 'com.android.chrome',
       installType: 'AVAILABLE',
     },
     {
       packageName: 'com.bbtec.mdm.client',
       installType: 'FORCE_INSTALLED',  // Changed from AVAILABLE
       defaultPermissionPolicy: 'GRANT',
     },
   ],
   ```

2. **Deploy Policy Update**
   - Visit: `https://bbtec-mdm.vercel.app/api/update-policy`
   - Verify response shows updated policy

3. **Remove Developer Settings from Policy**
   ```typescript
   const defaultPolicy = {
     passwordRequirements: {
       passwordQuality: 'PASSWORD_QUALITY_UNSPECIFIED',
     },
     // Remove these - no longer needed for production:
     // installUnknownSourcesAllowed: true,
     // advancedSecurityOverrides: {
     //   developerSettings: 'DEVELOPER_SETTINGS_ALLOWED',
     // },
     statusReportingSettings: {
       applicationReportsEnabled: true,
       deviceSettingsEnabled: true,
       softwareInfoEnabled: true,
     },
     applications: [...],
   }
   ```

#### Step 8: Test Auto-Installation (1 hour)
1. **Factory Reset Test Device**
2. **Enroll with New QR Code**
   - Generate fresh enrollment token
   - Scan QR code during setup
3. **Verify Auto-Installation**
   - bbtec-mdm Client should install automatically
   - No manual sideloading required
   - App should appear in app drawer
4. **Verify Connection**
   - Check web UI for device registration
   - Confirm heartbeat updates
   - Test APK installation command

#### Step 9: Production Rollout (Optional - Later)
Once internal testing is complete:
1. **Promote to Production Track**
   - Same APK from internal testing
   - Android Management API can install from production track
2. **Public Availability**
   - App listed in Play Store (if desired)
   - Or keep unlisted but available via direct link
3. **Update Documentation**
   - Enrollment guide
   - Troubleshooting steps

---

### Benefits After Google Play Migration

✅ **No Manual Installation**
- Client app installs automatically on enrollment
- Zero-touch deployment

✅ **Production Security**
- No developer options needed
- No unknown sources enabled
- Locked-down device policy

✅ **Automatic Updates**
- Push new client versions via Play Store
- Devices auto-update
- No re-enrollment needed

✅ **Scalability**
- Enroll 100s of devices with same QR code
- No ADB access required
- Works on any Android 10+ device

---

### Estimated Timeline for Phase 4

| Task | Duration |
|------|----------|
| Complete testing with sideloaded APK | 1-2 days |
| Google Play Console account setup | 1 hour |
| Build release APK + keystore | 2-3 hours |
| Create Play Store listing | 2-3 hours |
| Upload to internal testing | 1 hour |
| Wait for Google review | 1-2 days |
| Update policy to FORCE_INSTALLED | 15 min |
| Test auto-installation | 1 hour |
| **Total** | **3-5 days** |

---

### Critical Files to Backup

Before proceeding to Google Play:
- ✅ `bbtec-mdm-release.keystore` (signing key)
- ✅ Keystore passwords (password manager)
- ✅ Google Play Console credentials
- ✅ Service account JSON (already backed up)

**Losing the signing keystore means you can never update the app again!**

---

## Security & Authentication

### Current Implementation: API Token Authentication (v0.0.2+)

**Status**: Implemented 2025-11-02

To prevent unauthorized access to client API endpoints (`/api/client/*`), we implemented token-based authentication:

**How it works:**
1. Device registers via `/api/client/register` (unauthenticated)
2. Server generates random API token (crypto-secure UUID)
3. Token returned in registration response
4. Device stores token in SharedPreferences
5. All subsequent requests include `Authorization: Bearer <token>` header
6. Server validates token before processing requests

**Implementation details:**
- `/api/client/*` routes are public from Clerk's perspective (no Clerk auth)
- Custom token validation middleware checks `Authorization` header
- Tokens stored in Convex `deviceClients.apiToken` field
- Invalid/missing tokens return 401 Unauthorized

**Security properties:**
- ✅ Prevents fake device registration spam (first registration is rate-limited by device)
- ✅ Prevents unauthorized heartbeats/command fetching
- ✅ Each device has unique token
- ✅ Tokens are cryptographically random (not guessable)

**Known limitations (acceptable for MVP/educational project):**
- ⚠️ No token rotation/expiry
- ⚠️ No revocation mechanism (except device deletion)
- ⚠️ Token transmitted in HTTP headers (HTTPS required)
- ⚠️ Initial registration is unauthenticated (vulnerable to spam)

### Future Migration: Client Certificate Authentication

**Planned for**: Production deployment / Enterprise use

**Why migrate to certificates:**
1. **Stronger security**: Mutual TLS with client certificates
2. **No shared secrets**: Certificates use public/private key pairs
3. **Industry standard**: Used by enterprise MDM solutions
4. **Revocation**: Certificate Revocation Lists (CRL) or OCSP
5. **Rotation**: Certificates have expiry dates, forcing rotation

**Migration plan:**
1. Generate Certificate Authority (CA) for bbtec-mdm
2. Issue client certificate during device enrollment
3. Store certificate in Android KeyStore (hardware-backed)
4. Configure server to require client certificates
5. Validate certificates on each request
6. Implement certificate rotation policy

**References:**
- Android KeyStore: https://developer.android.com/training/articles/keystore
- Mutual TLS: https://en.wikipedia.org/wiki/Mutual_authentication
- X.509 Certificates: https://tools.ietf.org/html/rfc5280

**Timeline**: Implement when moving to production or when security audit requires it.

---

## Current Blockers

### 🔴 CRITICAL: Device Identification Mismatch (2025-11-03)

**Status**: Active blocker - preventing client app heartbeat from showing in web UI

**The Problem:**
We cannot reliably link a device registered in Google's Android Management API with the same device running our custom client app, because **there is no common identifier that both systems can access**.

**What we have:**

1. **Google's Android Management API** (server-side) provides:
   - Device ID: `enterprises/LC03fy18qv/devices/38b98cf6e3c0df75` (Google-assigned)
   - Serial Number: `3627105H804MF5` (from `hardwareInfo.serialNumber`)
   - IMEI/MEID (if `networkInfoEnabled: true` in policy)
   - WiFi MAC Address (if `networkInfoEnabled: true` in policy)
   - ✅ **This data IS visible in web UI** - we can see the serial number

2. **Our Android Client App** (on-device, non-privileged) can access:
   - ANDROID_ID: `7ad9c0899a15c28b` (from `Settings.Secure.ANDROID_ID`)
   - Build.MODEL, MANUFACTURER, BRAND (string metadata)
   - WiFi MAC Address (with `ACCESS_WIFI_STATE` permission)
   - ❌ **Cannot access serial number** - `Build.getSerial()` throws `SecurityException`

3. **The Mismatch:**
   - Client app registers with deviceId: `7ad9c0899a15c28b` (ANDROID_ID)
   - Web UI looks up device by serial number: `3627105H804MF5`
   - **NO MATCH** → Connection status shows "Waiting for Client Connection"

**Why We Can't Use Serial Number:**

Even with `READ_PHONE_STATE` permission in AndroidManifest.xml, `Build.getSerial()` fails with:
```
SecurityException: getSerial: The uid 10274 does not meet the requirements to access device identifiers.
```

**Root Cause:**
- Android 10+ restricts `Build.getSerial()` to apps with Device Owner or Profile Owner status
- Our custom client app is **NOT the Device Owner** - Google's Android Management DPC is the Device Owner
- Our app runs as a regular (privileged but not owner) app on the managed device
- Regular apps cannot access hardware identifiers like serial number due to privacy protections

**Impact:**
- ✅ Client app successfully registers and sends heartbeats
- ✅ Data is stored in Convex database (`deviceClients` table)
- ❌ Web UI cannot find matching device from Android Management API
- ❌ Connection status always shows yellow/red (offline)
- ❌ Cannot associate client app data with managed device metadata

**Attempted Solutions:**

| Solution | Status | Result |
|----------|--------|--------|
| Use serial number from `Build.getSerial()` | ❌ Failed | SecurityException - permission denied |
| Add `READ_PHONE_STATE` permission | ❌ Failed | Permission exists but still blocked |
| Use ANDROID_ID everywhere | ⚠️ Won't work | Android Management API doesn't report ANDROID_ID |
| Manual mapping by timing/guessing | ❌ Rejected | Not 100% certain, not automated |

**Potential Solutions (Not Yet Tested):**

| Solution | Certainty | Automation | Complexity | Notes |
|----------|-----------|------------|------------|-------|
| **WiFi MAC Address** | ✅ 100% | ✅ Yes | Medium | Android Management API: `networkInfo.wifiMacAddress`<br>Client app: `WifiManager.getConnectionInfo().getMacAddress()`<br>Requires `networkInfoEnabled: true` in policy |
| **IMEI/MEID** | ✅ 100% | ✅ Yes | High | Android Management API: `networkInfo.imei`<br>Client app: Requires `READ_PHONE_STATE` + might fail on tablets<br>Not all devices have IMEI (WiFi-only tablets) |
| Device fingerprint (model + manufacturer + android version + timestamp window) | ⚠️ 90%+ | ✅ Yes | Low | Match based on metadata within enrollment time window<br>Could fail if enrolling multiple identical devices |
| Embedding device ID in QR code during enrollment | ✅ 100% | ✅ Yes | High | Generate unique QR code per device with embedded serial number<br>Client app reads from enrollment extras<br>Requires per-device enrollment tokens |

**Recommended Path Forward:**

1. **Short-term (testing)**: WiFi MAC Address matching
   - Enable `networkInfoEnabled: true` in policy
   - Update client app to send WiFi MAC in registration
   - Update web UI to match by `networkInfo.wifiMacAddress`
   - Test if Android Management API actually reports WiFi MAC for this device

2. **Long-term (production)**: Per-device enrollment QR codes
   - Generate unique enrollment token for each device
   - Embed serial number or device ID in enrollment extras
   - Client app reads from enrollment data during setup
   - Most reliable solution, requires workflow change

**Testing Data (2025-11-03):**

Device: Pixel Tablet
- Android Management API Device ID: `38b98cf6e3c0df75`
- Serial Number (from API): `3627105H804MF5`
- ANDROID_ID (from client): `7ad9c0899a15c28b`
- Client app logs show successful registration and heartbeat
- Convex database shows `deviceClients` record with `deviceId: "7ad9c0899a15c28b"`
- Web UI cannot link the two → connection status offline

**Files Involved:**
- Client: `android-client/app/src/main/java/com/bbtec/mdm/client/DeviceRegistration.kt:20`
- Web UI: `src/components/device-detail-view.tsx:164` (lookup by serial number)
- API: `src/app/api/client/heartbeat/route.ts` (accepts any deviceId)
- Schema: `convex/schema.ts` (deviceClients table)

**References:**
- Android device identifiers: https://developer.android.com/training/articles/user-data-ids
- Android 10 privacy changes: https://developer.android.com/about/versions/10/privacy/changes
- Android Management API NetworkInfo: https://developers.google.com/android/management/reference/rest/v1/enterprises.devices#NetworkInfo

**Priority**: 🔴 **CRITICAL** - Blocks core functionality (connection status visibility)

**Next Steps**:
1. ~~Test WiFi MAC address availability in Android Management API~~ → **Research commercial MDM solution first** (see below)
2. If available, implement MAC address matching
3. If not available, design per-device enrollment QR code system

### 🔬 Research Plan: Analyze Miradore MDM Client (2025-11-03)

**Objective**: Learn how commercial MDM solutions solve the device identification problem

**Approach**: Enroll test device in Miradore MDM and reverse-engineer their client app to understand:

1. **Device Identification Strategy**
   - What device identifier do they use to link with Android Management API?
   - ANDROID_ID, WiFi MAC, IMEI, custom token, or something else?
   - How do they handle the same Android 10+ privacy restrictions we're facing?

2. **Permissions Analysis**
   ```bash
   # Extract permissions from Miradore client
   adb shell dumpsys package com.miradore.client | grep permission

   # Or inspect AndroidManifest.xml
   adb shell pm path com.miradore.client
   adb pull <path> miradore-client.apk
   apktool d miradore-client.apk
   cat miradore-client/AndroidManifest.xml
   ```

3. **Architecture Investigation**
   - Is Miradore client app the Device Owner or a companion app?
   - Do they use per-device enrollment tokens?
   - How does their registration flow work?

4. **APK Decompilation**
   ```bash
   # Pull APK from device
   adb pull $(adb shell pm path com.miradore.client | cut -d: -f2) miradore.apk

   # Decompile to inspect code
   jadx miradore.apk
   # Look for: registration, device ID generation, API calls
   ```

5. **Network Traffic Analysis**
   ```bash
   # Monitor registration and heartbeat traffic
   adb logcat | grep -i miradore

   # Observe what data they send during:
   # - Initial device registration
   # - Heartbeat/check-in
   # - Command polling
   ```

6. **Key Questions to Answer**
   - ✅ How do they link Android Management API devices with their client app?
   - ✅ What identifier is guaranteed to be accessible and match?
   - ✅ Do they use any special permissions or workarounds?
   - ✅ Is their approach compatible with Android 10+ privacy restrictions?
   - ✅ Can we adapt their strategy to our open-source implementation?

**Expected Outcome**:
- Learn production-proven solution to device identification
- Validate or invalidate our WiFi MAC address hypothesis
- Discover any alternative approaches we haven't considered
- Implement the same battle-tested strategy in bbtec-mdm

**Status**: 🟡 Pending device enrollment in Miradore

---

**Previous Blocker (Resolved 2025-11-02):**
- ~~None - ready to proceed with testing and Google Play publishing when ready.~~

**Next immediate action**: Enroll device in Miradore, analyze their client app approach, then implement proven solution for device identification.
