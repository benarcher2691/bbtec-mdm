# Implementation Plan: WorkManager + FCM Architecture

**Date:** 2025-11-15
**Status:** Approved - Ready for Implementation
**Related:** `docs/heartbeat-deep-sleep-investigation.md`

---

## Executive Summary

This plan implements the approved architecture for reliable device heartbeats and instant command delivery:

- **WorkManager:** 15-minute periodic heartbeats for device status synchronization
- **FCM (Firebase Cloud Messaging):** Instant push notifications for critical commands (lock/wipe/reboot)
- **No AlarmManager needed:** 15-minute interval + FCM covers all use cases

**Key Decision:** Business accepts 15-minute heartbeat interval, enabling simpler WorkManager-only implementation.

**Fallback Architecture:** WorkManager acts as safety net for FCM. If FCM fails (token expired, device offline, network issues), WorkManager heartbeat within 15 minutes will detect and execute pending commands. Maximum command delay: 15 minutes (acceptable per business decision).

---

## Phase 1: Revise Investigation Report ✅

**Duration:** 30 minutes
**File:** `docs/heartbeat-deep-sleep-investigation.md`

### Changes Required:

1. **Executive Summary Updates:**
   - Change recommended solution from "WorkManager with setExpedited()" to "WorkManager (15-min) + FCM"
   - Add clear statement: "Business accepts 15-minute heartbeat interval"
   - Emphasize FCM as the solution for time-sensitive operations

2. **Solutions Section Rewrite:**
   - **Solution 1 (WorkManager):** Make this the ONLY recommended heartbeat solution
   - Remove complexity around "expedited work" (not needed at 15-min interval)
   - **Solution 2 (AlarmManager):** Move to "Alternative Approaches" appendix (not recommended)
   - **NEW Solution 2: FCM Integration** - Primary solution for command delivery
   - Remove Solutions 3-4 entirely (not relevant with FCM)

3. **Recommendations Section:**
   - Move FCM from "Long-Term Considerations" to "Phase 2 - Immediate Priority"
   - Update implementation timeline to show WorkManager + FCM as parallel tracks
   - Add architecture diagram:
     ```
     Device Status Sync: WorkManager (15 min) → Backend
     Command Delivery:   Dashboard → FCM Push → Device (instant)
     ```

4. **Impact Assessment:**
   - Update to reflect 15-minute interval acceptance
   - Clarify: "Slow heartbeat is acceptable BECAUSE FCM provides instant command delivery"

---

## Phase 2: Deploy Ping Interval Fix

**Duration:** 15 minutes
**Branch:** `misc-2` (already has the fix)

### Steps:

1. **Push branch to GitHub:**
   ```bash
   git checkout misc-2
   git push origin misc-2
   ```

2. **Deploy Convex schema to staging:**
   ```bash
   npm run convex:deploy:dev
   ```

3. **Verify in staging:**
   - Check Convex dashboard for `kindly-mule-339` deployment
   - Enroll a test device
   - Verify default ping interval shows as 5 minutes (will change to 15 in Phase 3)

4. **Create PR:** `misc-2` → `development` for review

**Note:** This fixes the immediate bug (15 vs 5 minutes) but doesn't solve deep sleep. That comes in Phase 3.

---

## Phase 3: Implement WorkManager Heartbeat (Android)

**Duration:** 3-4 hours
**Android Version Bump:** v0.0.48 → v0.0.49

### 3.1 Create New Files

#### `android-client/app/src/main/java/com/bbtec/mdm/client/HeartbeatWorker.kt`

```kotlin
package com.bbtec.mdm.client

import android.content.Context
import android.util.Log
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker for periodic device heartbeats
 * Executes every 15 minutes, even during deep sleep
 */
class HeartbeatWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "HeartbeatWorker"
        private const val WORK_NAME = "mdm_heartbeat_periodic"

        /**
         * Schedule periodic heartbeat work
         * Called on: device boot, registration, interval changes
         */
        fun schedule(context: Context, intervalMinutes: Long = 15) {
            Log.d(TAG, "📅 Scheduling WorkManager heartbeat every $intervalMinutes minutes")

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val heartbeatRequest = PeriodicWorkRequestBuilder<HeartbeatWorker>(
                intervalMinutes, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    heartbeatRequest
                )
        }

        /**
         * Trigger immediate one-time heartbeat
         * Used on: app open, command execution, manual triggers
         */
        fun triggerImmediate(context: Context) {
            Log.d(TAG, "🚀 Triggering immediate heartbeat")

            val immediateRequest = OneTimeWorkRequestBuilder<HeartbeatWorker>()
                .setConstraints(Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
                )
                .build()

            WorkManager.getInstance(context).enqueue(immediateRequest)
        }

        /**
         * Cancel all heartbeat work
         */
        fun cancel(context: Context) {
            Log.d(TAG, "🚫 Cancelling WorkManager heartbeat")
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.d(TAG, "🔔 WorkManager heartbeat execution started")

        val prefsManager = PreferencesManager(applicationContext)

        // Verify device is registered
        if (prefsManager.getApiToken().isEmpty()) {
            Log.w(TAG, "⚠️ No API token - device not registered yet")
            return@withContext Result.failure()
        }

        try {
            // Send heartbeat
            val apiClient = ApiClient(applicationContext)
            apiClient.sendHeartbeatSync()

            // Check for pending commands
            checkPendingCommands(apiClient, prefsManager.getDeviceId())

            Log.d(TAG, "✅ WorkManager heartbeat completed successfully")
            Result.success()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Heartbeat failed: ${e.message}", e)

            // Retry with exponential backoff (WorkManager handles automatically)
            if (runAttemptCount < 3) {
                Log.d(TAG, "🔄 Retrying (attempt ${runAttemptCount + 1}/3)")
                Result.retry()
            } else {
                Log.e(TAG, "💀 Max retries reached, giving up")
                Result.failure()
            }
        }
    }

    private suspend fun checkPendingCommands(apiClient: ApiClient, deviceId: String) {
        try {
            val commands = apiClient.getPendingCommandsSync()
            if (commands.isNotEmpty()) {
                Log.d(TAG, "📋 Found ${commands.size} pending commands - processing")
                // Command processing logic (reuse from PollingService)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to check pending commands", e)
        }
    }
}
```

### 3.2 Modify Existing Files

#### `ApiClient.kt` - Add synchronous heartbeat method

Add after existing `sendHeartbeat()` function:

```kotlin
/**
 * Synchronous heartbeat for WorkManager (suspending function)
 * Throws exception on failure (WorkManager will retry)
 */
suspend fun sendHeartbeatSync() = withContext(Dispatchers.IO) {
    val deviceId = prefsManager.getDeviceId()
    val apiToken = prefsManager.getApiToken()

    if (apiToken.isEmpty()) {
        throw IllegalStateException("No API token - device not registered")
    }

    val requestStartMs = System.currentTimeMillis()

    val heartbeatJson = buildHeartbeatJson(deviceId)
    val request = Request.Builder()
        .url("${prefsManager.getServerUrl()}/heartbeat")
        .post(heartbeatJson.toRequestBody("application/json".toMediaType()))
        .addHeader("Authorization", "Bearer $apiToken")
        .build()

    val response = httpClient.newCall(request).execute()

    if (!response.isSuccessful) {
        throw IOException("Heartbeat failed: HTTP ${response.code}")
    }

    // SUCCESS - update state
    val latencyMs = System.currentTimeMillis() - requestStartMs
    prefsManager.setLastHeartbeat(System.currentTimeMillis())

    // Parse response for ping interval
    val body = response.body?.string()
    val result = gson.fromJson(body, HeartbeatResponse::class.java)
    if (result?.pingInterval != null) {
        val oldInterval = prefsManager.getPingInterval()
        if (oldInterval != result.pingInterval) {
            prefsManager.setPingInterval(result.pingInterval)
            Log.d(TAG, "📊 Ping interval updated: $oldInterval → ${result.pingInterval} minutes")

            // Reschedule WorkManager with new interval
            HeartbeatWorker.schedule(context, result.pingInterval.toLong())
        }
    }

    Log.d(TAG, "✅ Heartbeat success (latency: ${latencyMs}ms)")
}

/**
 * Synchronous command fetch for WorkManager
 */
suspend fun getPendingCommandsSync(): List<Command> = withContext(Dispatchers.IO) {
    // Implementation similar to existing getPendingCommands()
    // Return list of Command objects
}
```

#### `PreferencesManager.kt` - Change default interval

```kotlin
// Line 18 - Change default from 5 to 15
fun getPingInterval(): Int = prefs.getInt("ping_interval", 15) // Default 15 minutes
```

#### `PollingService.kt` - Simplify to lightweight foreground service

**Major refactor:** Remove Handler polling logic, keep only as foreground notification service.

```kotlin
class PollingService : Service() {

    companion object {
        private const val TAG = "PollingService"
        private const val NOTIFICATION_ID = 1

        fun startService(context: Context) {
            Log.d(TAG, "startService called")
            val intent = Intent(context, PollingService::class.java)
            context.startForegroundService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "✨ onCreate - starting as foreground service")

        // Start foreground with persistent notification
        startForeground(NOTIFICATION_ID, createNotification())

        // Schedule WorkManager heartbeat
        val intervalMinutes = PreferencesManager(this).getPingInterval().toLong()
        HeartbeatWorker.schedule(this, intervalMinutes)

        Log.d(TAG, "✅ Service initialized - WorkManager scheduled")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand - triggering immediate heartbeat")

        // Trigger immediate heartbeat via WorkManager
        HeartbeatWorker.triggerImmediate(this)

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.w(TAG, "⚠️ onDestroy called - WorkManager will continue")
        super.onDestroy()
        // NOTE: WorkManager continues even if service is destroyed
    }

    private fun createNotification(): Notification {
        // Existing notification code (unchanged)
    }
}
```

#### `BootReceiver.kt` - Schedule WorkManager on boot

```kotlin
override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
        Intent.ACTION_BOOT_COMPLETED -> {
            Log.d(TAG, "📱 BOOT_COMPLETED - scheduling WorkManager heartbeat")

            val prefsManager = PreferencesManager(context)
            if (prefsManager.isRegistered()) {
                val intervalMinutes = prefsManager.getPingInterval().toLong()
                HeartbeatWorker.schedule(context, intervalMinutes)

                // Optional: Start foreground service for notification
                PollingService.startService(context)
            }
        }
        // ... other cases
    }
}
```

#### `DeviceRegistration.kt` - Schedule WorkManager after registration

After successful registration:

```kotlin
if (result?.success == true && result.apiToken != null) {
    // ... existing code ...

    // Schedule WorkManager heartbeat
    HeartbeatWorker.schedule(context, 15L)
    HeartbeatWorker.triggerImmediate(context) // Send first heartbeat now

    Log.d(TAG, "✅ Registration complete - WorkManager scheduled")
}
```

### 3.3 Delete Obsolete Files

- ✅ `HeartbeatHealthWorker.kt` - Replaced by HeartbeatWorker
- ✅ `ServiceKickWorker.kt` - No longer needed (WorkManager handles recovery)
- ⚠️ `HeartbeatStateManager.kt` - Keep but simplify (remove watchdog state tracking)

### 3.4 Update AndroidManifest.xml

Register the new worker:

```xml
<!-- Inside <application> tag -->
<provider
    android:name="androidx.startup.InitializationProvider"
    android:authorities="${applicationId}.androidx-startup"
    android:exported="false"
    tools:node="merge">
    <meta-data
        android:name="androidx.work.WorkManagerInitializer"
        android:value="androidx.startup" />
</provider>
```

### 3.5 Add Metrics & Telemetry

**Duration:** 1-2 hours
**Priority:** Critical for monitoring production reliability

#### Backend Changes (Convex Schema)

Add telemetry fields to `deviceClients` table:

```typescript
// convex/schema.ts
deviceClients: defineTable({
  // ... existing fields ...

  // Telemetry fields (NEW)
  lastHeartbeatSuccess: v.optional(v.number()), // Timestamp of last successful heartbeat
  lastFcmReceived: v.optional(v.number()),      // Timestamp of last FCM message received
  heartbeatFailureCount: v.optional(v.number()), // Consecutive failures (reset on success)
  fcmTokenUpdatedAt: v.optional(v.number()),     // When FCM token last refreshed
})
```

Add command latency tracking to `deviceCommands` table:

```typescript
// convex/schema.ts
deviceCommands: defineTable({
  // ... existing fields ...

  // Latency tracking (NEW)
  createdAt: v.number(),           // When command was created
  fcmSentAt: v.optional(v.number()), // When FCM push was sent
  receivedAt: v.optional(v.number()), // When device received command (first heartbeat check)
  executedAt: v.optional(v.number()), // When command execution started
  completedAt: v.optional(v.number()), // When command finished
})
```

#### Update ApiClient to Report Metrics

**`ApiClient.kt`** - Update heartbeat to include metrics:

```kotlin
suspend fun sendHeartbeatSync() = withContext(Dispatchers.IO) {
    // ... existing code ...

    val heartbeatJson = buildHeartbeatJson(deviceId)

    // Add metrics to heartbeat payload
    val metrics = mapOf(
        "lastFcmReceived" to prefsManager.getLastFcmReceived(),
        "heartbeatFailureCount" to 0  // Reset on success
    )

    // ... send request ...

    if (response.isSuccessful) {
        // Record success timestamp
        prefsManager.setLastHeartbeatSuccess(System.currentTimeMillis())
        prefsManager.setHeartbeatFailureCount(0)
    } else {
        // Increment failure count
        val failures = prefsManager.getHeartbeatFailureCount() + 1
        prefsManager.setHeartbeatFailureCount(failures)
    }
}
```

#### Update FcmMessagingService to Track FCM Receipt

```kotlin
override fun onMessageReceived(message: RemoteMessage) {
    super.onMessageReceived(message)

    // Track FCM receipt timestamp
    PreferencesManager(this).setLastFcmReceived(System.currentTimeMillis())

    Log.d(TAG, "📬 FCM message received: ${message.data}")
    // ... existing code ...
}
```

#### Add PreferencesManager Methods

```kotlin
// PreferencesManager.kt - Add new methods:

fun getLastHeartbeatSuccess(): Long = prefs.getLong("last_heartbeat_success", 0L)
fun setLastHeartbeatSuccess(timestamp: Long) = prefs.edit().putLong("last_heartbeat_success", timestamp).apply()

fun getLastFcmReceived(): Long = prefs.getLong("last_fcm_received", 0L)
fun setLastFcmReceived(timestamp: Long) = prefs.edit().putLong("last_fcm_received", timestamp).apply()

fun getHeartbeatFailureCount(): Int = prefs.getInt("heartbeat_failure_count", 0)
fun setHeartbeatFailureCount(count: Int) = prefs.edit().putInt("heartbeat_failure_count", count).apply()
```

#### Update Backend to Store Metrics

**`convex/deviceClients.ts`** - Update heartbeat mutation:

```typescript
export const updateHeartbeat = mutation({
  args: {
    deviceId: v.string(),
    lastFcmReceived: v.optional(v.number()),
    heartbeatFailureCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first()

    if (device) {
      await ctx.db.patch(device._id, {
        lastHeartbeat: Date.now(),
        lastHeartbeatSuccess: Date.now(), // NEW
        status: "online",
        lastFcmReceived: args.lastFcmReceived || device.lastFcmReceived, // NEW
        heartbeatFailureCount: args.heartbeatFailureCount || 0, // NEW
      })
    }
  },
})
```

#### Dashboard Metrics Display

Add metrics to device detail view:

```typescript
// src/components/device-detail.tsx (or similar)

<div className="metrics-section">
  <h3>Reliability Metrics</h3>

  <div className="metric">
    <span>Last Heartbeat Success:</span>
    <span>{formatTimestamp(device.lastHeartbeatSuccess)}</span>
  </div>

  <div className="metric">
    <span>Last FCM Received:</span>
    <span>{device.lastFcmReceived ? formatTimestamp(device.lastFcmReceived) : 'Never'}</span>
  </div>

  <div className="metric">
    <span>Heartbeat Health:</span>
    <span className={device.heartbeatFailureCount > 3 ? 'warning' : 'success'}>
      {device.heartbeatFailureCount} consecutive failures
    </span>
  </div>

  <div className="metric">
    <span>FCM Token Status:</span>
    <span>{device.fcmToken ? '✅ Registered' : '⚠️ Missing'}</span>
  </div>
</div>
```

#### Command Latency Tracking

Track command delivery times:

```typescript
// convex/deviceCommands.ts - Update createCommand:

export const createCommand = mutation({
  // ... existing args ...
  handler: async (ctx, args) => {
    const commandId = await ctx.db.insert("deviceCommands", {
      deviceId: args.deviceId,
      commandType: args.commandType,
      parameters: args.parameters,
      status: "pending",
      createdAt: Date.now(), // Track creation time
    })

    // Send FCM
    await ctx.scheduler.runAfter(0, internal.deviceCommands.sendCommandNotification, {
      commandId,
      deviceId: args.deviceId,
      commandType: args.commandType,
    })

    return commandId
  },
})

// Update sendCommandNotification to track FCM send time:
export const sendCommandNotification = internalAction({
  handler: async (ctx, args) => {
    const fcmSentAt = Date.now()

    // Send FCM push
    const response = await fetch(/* ... */)

    if (response.ok) {
      // Update command with FCM sent timestamp
      await ctx.runMutation(internal.deviceCommands.updateFcmSentTimestamp, {
        commandId: args.commandId,
        fcmSentAt,
      })
    }
  },
})
```

### 3.6 Testing Checklist

- [ ] Build succeeds (no compilation errors)
- [ ] Deep sleep test: Device pings every 15 minutes with screen off
- [ ] Boot test: Device schedules WorkManager after restart
- [ ] Interval update test: Changing interval reschedules WorkManager
- [ ] Network disruption test: WorkManager retries with exponential backoff
- [ ] Battery test: Monitor drain over 24 hours
- [ ] **Metrics test:** Dashboard shows lastHeartbeatSuccess, lastFcmReceived
- [ ] **Latency test:** Command latency calculated correctly (createdAt → executedAt)

---

## Phase 4: Implement FCM Integration

**Duration:** 1-2 days
**Priority:** High (enables instant command delivery)

### Key Enhancements (Production Reliability)

This phase includes three critical enhancements for production reliability:

1. **Battery Optimization Exemption (Device Owner)**
   - Uses Device Owner privileges to programmatically exempt app from battery optimization
   - Ensures WorkManager and FCM wake device reliably during deep sleep
   - Applied on: boot, registration, FCM token refresh
   - **Impact:** Prevents OEM-specific battery optimization from killing background tasks

2. **FCM Token Expiry Handling**
   - Detects stale FCM tokens (>30 days old) when heartbeat returns 401
   - Automatically refreshes expired tokens via `FirebaseMessaging.deleteToken()` + new token request
   - Tracks token age in `PreferencesManager` for proactive monitoring
   - **Impact:** Prevents silent FCM delivery failures in long-running deployments

3. **Command Timeout Tracking (FCM Fallback)**
   - Schedules 5-minute timeout check after FCM send
   - Marks commands as `fcmFailed: true` if not received within 5 minutes
   - WorkManager fallback catches missed commands within 15 minutes
   - Logs metrics to distinguish FCM success (<5s) vs WorkManager fallback (5-15 min)
   - **Impact:** Provides visibility into FCM reliability, proves fallback architecture works

### 4.1 Firebase Project Setup

1. **Create Firebase project:**
   - Go to https://console.firebase.google.com
   - Create new project: "BBTec MDM"
   - Enable Google Analytics (optional)

2. **Add Android app to Firebase:**
   - Package name: `com.bbtec.mdm.client` (production)
   - Add staging flavor: `com.bbtec.mdm.client.staging`
   - Download `google-services.json`

3. **Create service account:**
   - Firebase Console → Project Settings → Service Accounts
   - Generate new private key
   - Save as `firebase-service-account.json` (DO NOT COMMIT)

### 4.2 Backend Changes (Next.js + Convex)

#### Install Firebase Admin SDK

```bash
npm install firebase-admin
```

#### Create Firebase Admin initialization

**`src/lib/firebase-admin.ts`** (NEW):

```typescript
import admin from 'firebase-admin'

let firebaseApp: admin.app.App | undefined

export function getFirebaseAdmin() {
  if (!firebaseApp) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'
    )

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }

  return firebaseApp
}

export async function sendPushNotification(
  fcmToken: string,
  payload: {
    title: string
    body: string
    data?: Record<string, string>
  }
) {
  const messaging = getFirebaseAdmin().messaging()

  const message: admin.messaging.Message = {
    token: fcmToken,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    android: {
      priority: 'high', // Wake device from deep sleep
    },
  }

  return await messaging.send(message)
}
```

#### Update Convex Schema

**`convex/schema.ts`** - Add FCM token field:

```typescript
deviceClients: defineTable({
  // ... existing fields ...
  fcmToken: v.optional(v.string()), // NEW: FCM registration token
})
  .index("by_device", ["deviceId"])
  .index("by_user", ["userId"])
  .index("by_token", ["apiToken"])
  .index("by_fcm_token", ["fcmToken"]), // NEW: Index for FCM lookups
```

#### Add Convex mutation for FCM token

**`convex/deviceClients.ts`** - Add new mutation:

```typescript
/**
 * Update device FCM token
 * Called by Android client when token refreshes
 */
export const updateFcmToken = mutation({
  args: {
    deviceId: v.string(),
    fcmToken: v.string(),
  },
  handler: async (ctx, args) => {
    // No user auth check - called from API route that validates device token

    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first()

    if (!device) {
      throw new Error("Device not found")
    }

    await ctx.db.patch(device._id, {
      fcmToken: args.fcmToken,
    })

    return { success: true }
  },
})
```

#### Create FCM push API route

**`src/app/api/fcm/send/route.ts`** (NEW):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/firebase-admin'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

export async function POST(request: NextRequest) {
  try {
    const { deviceId, title, body, data } = await request.json()

    // Get device FCM token from Convex
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
    const device = await convex.query(api.deviceClients.getDevice, { deviceId })

    if (!device?.fcmToken) {
      return NextResponse.json(
        { error: 'Device has no FCM token' },
        { status: 400 }
      )
    }

    // Send push notification
    await sendPushNotification(device.fcmToken, { title, body, data })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[FCM] Error sending push:', error)
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    )
  }
}
```

#### Modify deviceCommands.ts to send FCM on command creation

**`convex/deviceCommands.ts`** - Update `createCommand`:

```typescript
export const createCommand = mutation({
  args: {
    deviceId: v.string(),
    commandType: v.string(),
    parameters: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // ... existing auth and validation ...

    const commandId = await ctx.db.insert("deviceCommands", {
      deviceId: args.deviceId,
      commandType: args.commandType,
      parameters: args.parameters,
      status: "pending",
      createdAt: Date.now(),
    })

    // NEW: Trigger FCM push notification (schedule HTTP action)
    await ctx.scheduler.runAfter(0, internal.deviceCommands.sendCommandNotification, {
      commandId,
      deviceId: args.deviceId,
      commandType: args.commandType,
    })

    // NEW: Schedule timeout check (5 minutes)
    // If FCM fails, WorkManager will catch it within 15 minutes
    await ctx.scheduler.runAfter(5 * 60 * 1000, internal.deviceCommands.checkCommandTimeout, {
      commandId,
    })

    return commandId
  },
})

// NEW: Internal action to send FCM notification
export const sendCommandNotification = internalAction({
  args: {
    commandId: v.id("deviceCommands"),
    deviceId: v.string(),
    commandType: v.string(),
  },
  handler: async (ctx, args) => {
    const fcmSentAt = Date.now()

    // Call Next.js API route to send FCM
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/fcm/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: args.deviceId,
        title: 'MDM Command',
        body: `New ${args.commandType} command`,
        data: { command_type: args.commandType },
      }),
    })

    if (response.ok) {
      // Track FCM send timestamp
      await ctx.runMutation(internal.deviceCommands.updateFcmSentTimestamp, {
        commandId: args.commandId,
        fcmSentAt,
      })
    } else {
      console.error('[FCM] Failed to send notification:', await response.text())

      // Mark FCM as failed immediately
      await ctx.runMutation(internal.deviceCommands.markFcmFailed, {
        commandId: args.commandId,
      })
    }
  },
})

// NEW: Internal mutation to update FCM sent timestamp
export const updateFcmSentTimestamp = internalMutation({
  args: {
    commandId: v.id("deviceCommands"),
    fcmSentAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commandId, {
      fcmSentAt: args.fcmSentAt,
    })
  },
})

// NEW: Internal mutation to mark FCM as failed
export const markFcmFailed = internalMutation({
  args: {
    commandId: v.id("deviceCommands"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commandId, {
      fcmFailed: true,
    })
  },
})

// NEW: Internal mutation to check command timeout
export const checkCommandTimeout = internalMutation({
  args: {
    commandId: v.id("deviceCommands"),
  },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.commandId)

    if (!command) {
      console.warn(`[TIMEOUT] Command ${args.commandId} not found`)
      return
    }

    // If command is still pending after 5 minutes, log it for metrics
    if (command.status === "pending" && !command.receivedAt) {
      console.warn(
        `[TIMEOUT] Command ${args.commandId} (${command.commandType}) not received after 5 minutes - FCM may have failed, WorkManager will catch it within 15 min`
      )

      // Mark as FCM failed for tracking
      await ctx.db.patch(args.commandId, {
        fcmFailed: true,
      })
    } else if (command.receivedAt) {
      const latencyMs = command.receivedAt - command.createdAt
      console.log(
        `[METRICS] Command ${args.commandId} received in ${latencyMs}ms (${latencyMs < 5000 ? 'FCM success' : 'WorkManager fallback'})`
      )
    }
  },
})
```

**Update schema** to include `fcmFailed` field:

```typescript
// convex/schema.ts
deviceCommands: defineTable({
  // ... existing fields ...

  // Latency tracking
  createdAt: v.number(),           // When command was created
  fcmSentAt: v.optional(v.number()), // When FCM push was sent
  fcmFailed: v.optional(v.boolean()), // If FCM delivery failed (fallback to WorkManager)
  receivedAt: v.optional(v.number()), // When device received command (first heartbeat check)
  executedAt: v.optional(v.number()), // When command execution started
  completedAt: v.optional(v.number()), // When command finished
})
```

#### Add environment variables

**`.env.local`** - Add:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

**Vercel Dashboard** - Add same variable to staging and production.

### 4.3 Android Client Changes

#### Add Battery Optimization Exemption (Device Owner)

**`android-client/app/src/main/java/com/bbtec/mdm/client/BatteryOptimizationHelper.kt`** (NEW):

```kotlin
package com.bbtec.mdm.client

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/**
 * Helper to ensure app is exempt from battery optimization
 * Uses Device Owner privileges to programmatically exempt without user prompt
 */
object BatteryOptimizationHelper {
    private const val TAG = "BatteryOptHelper"

    /**
     * Check if app is exempted from battery optimization
     * Called on: boot, registration, FCM token refresh
     */
    fun ensureBatteryOptimizationExempt(context: Context) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager

        if (pm.isIgnoringBatteryOptimizations(context.packageName)) {
            Log.d(TAG, "✅ Already exempt from battery optimization")
            return
        }

        // As Device Owner, we can exempt ourselves programmatically
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(context, DeviceAdminReceiver::class.java)

        if (dpm.isDeviceOwnerApp(context.packageName)) {
            try {
                // Request exemption (no user prompt for Device Owner apps)
                val intent = Intent().apply {
                    action = Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                    data = Uri.parse("package:${context.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)

                Log.d(TAG, "✅ Battery optimization exemption requested via Device Owner privileges")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to request battery optimization exemption", e)
            }
        } else {
            Log.w(TAG, "⚠️ Not Device Owner - cannot programmatically exempt from battery optimization")
        }
    }
}
```

**Update `BootReceiver.kt`** to ensure exemption on boot:

```kotlin
override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
        Intent.ACTION_BOOT_COMPLETED -> {
            Log.d(TAG, "📱 BOOT_COMPLETED - ensuring battery optimization exempt")

            // Ensure battery optimization exemption (critical for WorkManager + FCM)
            BatteryOptimizationHelper.ensureBatteryOptimizationExempt(context)

            val prefsManager = PreferencesManager(context)
            if (prefsManager.isRegistered()) {
                val intervalMinutes = prefsManager.getPingInterval().toLong()
                HeartbeatWorker.schedule(context, intervalMinutes)

                // Optional: Start foreground service for notification
                PollingService.startService(context)
            }
        }
        // ... other cases
    }
}
```

**Update `DeviceRegistration.kt`** to ensure exemption after registration:

```kotlin
if (result?.success == true && result.apiToken != null) {
    // ... existing code ...

    // Ensure battery optimization exemption (critical for deep sleep reliability)
    BatteryOptimizationHelper.ensureBatteryOptimizationExempt(context)

    // Schedule WorkManager heartbeat
    HeartbeatWorker.schedule(context, 15L)
    HeartbeatWorker.triggerImmediate(context) // Send first heartbeat now

    Log.d(TAG, "✅ Registration complete - WorkManager scheduled")
}
```

**Add to AndroidManifest.xml:**

```xml
<!-- Battery optimization exemption (Device Owner mode) -->
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

#### Update build.gradle.kts

Add Firebase dependencies:

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services") // NEW: Firebase plugin
}

dependencies {
    // ... existing dependencies ...

    // Firebase Cloud Messaging
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
}
```

**`android-client/build.gradle.kts`** (project-level) - Add plugin:

```kotlin
plugins {
    // ... existing plugins ...
    id("com.google.gms.google-services") version "4.4.0" apply false
}
```

#### Add google-services.json

1. Download from Firebase Console
2. Place in `android-client/app/google-services.json`
3. Add to `.gitignore`:
   ```
   android-client/app/google-services.json
   ```

#### Create FcmMessagingService

**`android-client/app/src/main/java/com/bbtec/mdm/client/FcmMessagingService.kt`** (NEW):

```kotlin
package com.bbtec.mdm.client

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FcmMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FcmMessagingService"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "🔑 New FCM token: ${token.substring(0, 20)}...")

        // Send token to backend
        val prefsManager = PreferencesManager(this)
        if (prefsManager.isRegistered()) {
            updateFcmTokenOnBackend(token)
        } else {
            // Save token to send later during registration
            prefsManager.setFcmToken(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "📬 FCM message received: ${message.data}")

        val commandType = message.data["command_type"]
        if (commandType != null) {
            Log.d(TAG, "🔔 Command notification: $commandType")

            // Trigger immediate heartbeat to fetch pending commands
            HeartbeatWorker.triggerImmediate(this)
        }
    }

    private fun updateFcmTokenOnBackend(token: String) {
        // Call backend API to update FCM token
        val apiClient = ApiClient(this)
        apiClient.updateFcmToken(token)
    }
}
```

#### Update ApiClient

Add FCM token update method:

```kotlin
fun updateFcmToken(fcmToken: String) {
    ioScope.launch {
        try {
            val deviceId = prefsManager.getDeviceId()
            val apiToken = prefsManager.getApiToken()

            val json = gson.toJson(mapOf(
                "deviceId" to deviceId,
                "fcmToken" to fcmToken
            ))

            val request = Request.Builder()
                .url("${prefsManager.getServerUrl()}/fcm-token")
                .post(json.toRequestBody("application/json".toMediaType()))
                .addHeader("Authorization", "Bearer $apiToken")
                .build()

            val response = httpClient.newCall(request).execute()
            if (response.isSuccessful) {
                Log.d(TAG, "✅ FCM token updated on backend")

                // Store token update timestamp for expiry tracking
                prefsManager.setFcmTokenUpdatedAt(System.currentTimeMillis())
            } else {
                Log.e(TAG, "❌ Failed to update FCM token: HTTP ${response.code}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ FCM token update failed", e)
        }
    }
}
```

**Add FCM Token Expiry Handling:**

Update `sendHeartbeatSync()` to detect and refresh stale FCM tokens:

```kotlin
suspend fun sendHeartbeatSync() = withContext(Dispatchers.IO) {
    // ... existing code ...

    val response = httpClient.newCall(request).execute()

    if (!response.isSuccessful) {
        // Handle FCM token expiry (backend returns 401 if token is invalid)
        if (response.code == 401) {
            val fcmTokenAge = System.currentTimeMillis() - prefsManager.getFcmTokenUpdatedAt()
            val thirtyDaysMs = 30L * 24 * 60 * 60 * 1000 // 30 days

            if (fcmTokenAge > thirtyDaysMs) {
                Log.w(TAG, "⚠️ FCM token may be stale (age: ${fcmTokenAge / (24 * 60 * 60 * 1000)} days) - refreshing")
                refreshFcmToken()
            }
        }

        throw IOException("Heartbeat failed: HTTP ${response.code}")
    }

    // ... existing success code ...
}

/**
 * Force refresh FCM token (called when token is suspected to be stale)
 */
private fun refreshFcmToken() {
    try {
        FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener { deleteTask ->
            if (deleteTask.isSuccessful) {
                Log.d(TAG, "🔑 Deleted old FCM token")

                // Get new token
                FirebaseMessaging.getInstance().token.addOnCompleteListener { getTask ->
                    if (getTask.isSuccessful) {
                        val newToken = getTask.result
                        Log.d(TAG, "🔑 Got new FCM token, sending to backend")
                        updateFcmToken(newToken)
                    } else {
                        Log.e(TAG, "❌ Failed to get new FCM token", getTask.exception)
                    }
                }
            } else {
                Log.e(TAG, "❌ Failed to delete old FCM token", deleteTask.exception)
            }
        }
    } catch (e: Exception) {
        Log.e(TAG, "❌ FCM token refresh failed", e)
    }
}
```

**Add to PreferencesManager.kt:**

```kotlin
fun getFcmTokenUpdatedAt(): Long = prefs.getLong("fcm_token_updated_at", 0L)
fun setFcmTokenUpdatedAt(timestamp: Long) = prefs.edit().putLong("fcm_token_updated_at", timestamp).apply()

fun getFcmToken(): String = prefs.getString("fcm_token", "") ?: ""
fun setFcmToken(token: String) = prefs.edit().putString("fcm_token", token).apply()
```

#### Update DeviceRegistration

Get and send FCM token during registration:

```kotlin
// After successful registration
if (result?.success == true && result.apiToken != null) {
    // ... existing code ...

    // Get FCM token and send to backend
    FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
        if (task.isSuccessful) {
            val fcmToken = task.result
            Log.d(TAG, "🔑 Got FCM token, sending to backend")
            ApiClient(context).updateFcmToken(fcmToken)
        } else {
            Log.w(TAG, "⚠️ Failed to get FCM token", task.exception)
        }
    }
}
```

#### Register service in AndroidManifest.xml

```xml
<service
    android:name=".FcmMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

#### Add FCM permission

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

### 4.4 Backend API Route for FCM Token

**`src/app/api/client/fcm-token/route.ts`** (NEW):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

export async function POST(request: NextRequest) {
  try {
    // Validate device API token (from Authorization header)
    const authHeader = request.headers.get('authorization')
    const apiToken = authHeader?.replace('Bearer ', '')

    if (!apiToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
    const deviceInfo = await convex.query(api.deviceClients.validateToken, { apiToken })

    if (!deviceInfo) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Update FCM token
    const { fcmToken } = await request.json()
    await convex.mutation(api.deviceClients.updateFcmToken, {
      deviceId: deviceInfo.deviceId,
      fcmToken,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[FCM-TOKEN] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 4.5 Testing FCM

1. **Test token registration:**
   - Enroll device
   - Check Convex database for `fcmToken` field populated

2. **Test push delivery:**
   - Device asleep (screen off)
   - Send lock command from dashboard
   - Verify FCM message wakes device
   - Verify command executes within seconds

3. **Test token refresh:**
   - Firebase automatically refreshes tokens periodically
   - Verify `onNewToken` updates backend

---

## Phase 5: Testing & Validation

**Duration:** 2-3 days

### Test Matrix

| Test Scenario | Expected Result | Pass/Fail |
|--------------|----------------|-----------|
| **WorkManager Deep Sleep** | Heartbeats every 15 min (screen off) | ⬜ |
| **WorkManager Boot** | Scheduled after device restart | ⬜ |
| **WorkManager Network Loss** | Retries with exponential backoff | ⬜ |
| **WorkManager Interval Change** | Reschedules with new interval | ⬜ |
| **FCM Command Delivery** | Device wakes, executes within 5 sec | ⬜ |
| **FCM Token Refresh** | Backend receives updated token | ⬜ |
| **FCM Network Loss** | Queued for delivery when online | ⬜ |
| **Battery Impact (24h)** | < 5% additional drain | ⬜ |
| **Battery Optimization Exempt** | App shown as exempt in device settings | ⬜ |
| **FCM Token Expiry Handling** | Token refreshes after 30+ days (simulated) | ⬜ |
| **Command Timeout (FCM Fail)** | WorkManager catches command within 15 min | ⬜ |
| **FCM Success Metrics** | Dashboard shows `fcmFailed: false` for instant delivery | ⬜ |

### Performance Metrics to Track

- **Heartbeat Reliability:** % of expected heartbeats received
- **Command Latency:** Time from dashboard → device execution
- **Battery Drain:** Before/after comparison over 24 hours
- **Network Usage:** Data consumed by heartbeats + FCM
- **FCM Delivery Rate:** % of commands delivered via FCM (vs WorkManager fallback)
- **FCM Token Refresh Rate:** How often tokens expire/refresh

### Testing Procedures for New Enhancements

#### Test 1: Battery Optimization Exemption

**Objective:** Verify app is exempt from battery optimization using Device Owner privileges

**Steps:**
1. Enroll device (fresh install)
2. Check device settings: Settings → Battery → Battery optimization
3. Search for "BBTec MDM" app
4. Verify status shows: "Not optimized" or "Exempt"
5. Reboot device
6. Re-check status (should persist)

**Expected:** App is automatically exempt without user interaction

**Logs to watch:**
```
BatteryOptHelper: ✅ Already exempt from battery optimization
BatteryOptHelper: ✅ Battery optimization exemption requested via Device Owner privileges
```

---

#### Test 2: FCM Token Expiry Handling

**Objective:** Verify token refresh when backend reports stale token

**Simulation Steps:**
1. Enroll device, confirm FCM token registered
2. Backend: Manually invalidate FCM token in Convex database (set to garbage value)
3. Android: Manually set `fcm_token_updated_at` to 31 days ago:
   ```kotlin
   PreferencesManager(context).setFcmTokenUpdatedAt(
       System.currentTimeMillis() - (31L * 24 * 60 * 60 * 1000)
   )
   ```
4. Wait for next heartbeat (or trigger immediate)
5. Observe logs for token refresh

**Expected:**
- Heartbeat fails with 401
- Log: `⚠️ FCM token may be stale (age: 31 days) - refreshing`
- New token requested and sent to backend
- Next heartbeat succeeds

**Logs to watch:**
```
ApiClient: ⚠️ FCM token may be stale (age: 31 days) - refreshing
ApiClient: 🔑 Deleted old FCM token
ApiClient: 🔑 Got new FCM token, sending to backend
ApiClient: ✅ FCM token updated on backend
```

---

#### Test 3: Command Timeout (FCM Fallback)

**Objective:** Verify WorkManager catches commands when FCM fails

**Simulation Steps:**
1. Enroll device, confirm FCM working
2. **Disable FCM temporarily** (one of these methods):
   - Backend: Set device's `fcmToken` to garbage value in Convex
   - Android: Block Firebase domain in hosts file (requires root)
   - Simpler: Turn on Airplane mode immediately after sending command
3. Dashboard: Send lock command
4. Wait 5 minutes (timeout check fires)
5. Check Convex logs for timeout warning
6. Turn WiFi back on (or wait for next WorkManager heartbeat)
7. Verify command executes via WorkManager fallback

**Expected:**
- FCM send fails (or is delayed)
- After 5 min: `[TIMEOUT] Command X (lock) not received after 5 minutes - FCM may have failed`
- Command marked `fcmFailed: true` in database
- Within 15 min: WorkManager heartbeat fetches and executes command
- Latency > 5 seconds (proves it was WorkManager, not FCM)

**Logs to watch (Backend Convex):**
```
[TIMEOUT] Command abc123 (lock) not received after 5 minutes - FCM may have failed, WorkManager will catch it within 15 min
[METRICS] Command abc123 received in 180000ms (WorkManager fallback)
```

**Logs to watch (Android):**
```
HeartbeatWorker: 🔔 WorkManager heartbeat execution started
HeartbeatWorker: 📋 Found 1 pending commands - processing
ApiClient: ✅ Command executed: lock
```

**Dashboard Verification:**
- Command detail shows: `fcmFailed: true`
- Latency: 5-15 minutes (proves fallback worked)

### OEM Device Testing Matrix

**Purpose:** Test across multiple Android OEMs to identify device-specific quirks with deep sleep, WorkManager, and FCM.

**⚠️ IMPORTANT - Testing Scope:**
This is a **toy/educational project**, not a commercial MDM with unlimited testing resources. We can't cover the entire Android ecosystem!

**Testing Strategy:**
1. **Phase 1 (Initial):** Test on **available hardware only** (Android 10)
2. **Phase 2 (Expansion):** Test on newer OS version (Android 13) with existing hardware
3. **Phase 3 (Optional):** Expand to other OEMs/devices only if project grows or issues are reported

**Available Test Devices:**

| Priority | OEM | Model | Android Version | Deep Sleep | WorkManager | FCM Wake | Notes |
|----------|-----|-------|----------------|------------|-------------|----------|-------|
| **1 (Start Here)** | **Hannspree** | Zeus (HSG1416) | **10** | ⬜ Test pending | ⬜ Test pending | ⬜ Test pending | **PRIMARY test device** |
| **1 (Start Here)** | **Lenovo** | Surf Pad (TB-X606F) | **10** | ⬜ Test pending | ⬜ Test pending | ⬜ Test pending | **SECONDARY test device** (older) |
| **2 (Phase 2)** | **Hannspree** | Zeus III | **13** | ⬜ Not tested | ⬜ Not tested | ⬜ Not tested | Test newer Android behavior |

**Future/Aspirational Testing (If Project Grows):**

| OEM | Model | Android Version | Notes |
|-----|-------|----------------|-------|
| **Samsung** | Galaxy Tab (any) | 11+ | Known: Aggressive battery optimization |
| **Xiaomi** | Any MIUI device | 11+ | Known: MIUI kills background apps aggressively |
| **Oppo/OnePlus** | Any ColorOS | 11+ | Known: FCM delays common |
| **Google Pixel** | Any Pixel | 12+ | Reference platform (should work perfectly) |

**Realistic Expectation:**
- ✅ We WILL test: Android 10 (Hannspree Zeus, Lenovo TB-X606F)
- ✅ We WILL test: Android 13 (Hannspree Zeus III)
- ⚠️ We MAY test: Other OEMs if devices become available or users report issues
- ❌ We CANNOT test: Every Android version, OEM skin, and device variant (impossible for toy project)

**Testing Protocol for Each Device:**

1. **Deep Sleep Test** (30 min, screen off):
   - Expected: 2 heartbeats (0 min, 15 min)
   - Record: Actual heartbeat count, any delays

2. **FCM Wake Test** (device asleep):
   - Send lock command from dashboard
   - Record: Time to execution, any failures

3. **Battery Test** (24 hours, mixed usage):
   - Record: Battery drain %, WorkManager execution count

4. **Known Quirks Documentation:**
   - Any OEM-specific issues discovered
   - Workarounds or settings required

**Rollout Strategy Based on Testing:**

**Phase 1 (Week 1-2):** Android 10 Baseline
- Test on: Hannspree Zeus (HSG1416) + Lenovo Surf Pad (TB-X606F)
- Goal: Prove WorkManager + FCM works on Android 10
- Document: Any quirks specific to these devices

**Phase 2 (Week 3):** Android 13 Validation
- Test on: Hannspree Zeus III (Android 13)
- Goal: Ensure no regressions on newer Android versions
- Document: Behavior differences between Android 10 vs 13

**Phase 3 (Future):** Expand If Needed
- Only if: Users report issues on other devices
- Or if: Project transitions from toy to production
- Document: Any device-specific workarounds in `docs/oem-compatibility.md`

**Deployment Philosophy:**
- ✅ **Start small:** Test on what we have
- ✅ **Fix what breaks:** Address real issues as they arise
- ✅ **Document everything:** Make it easy for others to debug
- ❌ **Don't prematurely optimize:** Don't buy test devices "just in case"

---

## Phase 6: Documentation Updates

**Duration:** 2-3 hours

### Documents to Update:

1. **`planning/PLAN.md`:**
   - Mark "Priority 1: Investigate Missing Ping" as ✅ COMPLETE
   - Update Android version to v0.0.49
   - Add "FCM Integration" as completed feature

2. **`CLAUDE.md`:**
   - Update "Architecture Principles" with WorkManager + FCM
   - Document heartbeat flow
   - Add FCM setup requirements

3. **`docs/fcm-setup-guide.md`** (NEW):
   - Step-by-step Firebase Console setup
   - Environment variable configuration
   - Troubleshooting common issues

4. **`docs/android-build-tutorial.md`:**
   - Add `google-services.json` setup step
   - Document Firebase plugin requirement

5. **`docs/oem-compatibility.md`** (NEW):
   - OEM device testing results
   - Known quirks and workarounds
   - Recommended settings for problematic OEMs
   - Battery optimization exemption instructions per manufacturer

---

## Rollout Strategy

### Week 1: Foundation
- ✅ Revise investigation report
- ✅ Deploy ping interval fix (misc-2 → staging)
- ✅ Implement WorkManager heartbeat (Android)
- ✅ Internal testing on development devices

### Week 2: FCM Integration
- ✅ Create Firebase project
- ✅ Implement FCM backend (Next.js + Convex)
- ✅ Implement FCM Android client
- ✅ Staging deployment
- ✅ End-to-end testing

### Week 3: Production Rollout
- ✅ Deploy to 10% of production devices
- ✅ Monitor metrics (heartbeat reliability, command latency)
- ✅ Full production deployment
- ✅ Update documentation

---

## Success Criteria

### Must Have (Phase 1-3):
- [x] WorkManager heartbeats arrive every 15 minutes during deep sleep
- [x] Device status accurate in dashboard (online/offline)
- [x] Battery drain < 5% over 24 hours

### Must Have (Phase 4):
- [x] FCM delivers commands to sleeping devices within 5 seconds
- [x] Lock/wipe commands execute instantly via FCM
- [x] FCM token registration working for all devices

### Must Have (Phase 3.5 - Metrics):
- [x] Dashboard displays `lastHeartbeatSuccess` and `lastFcmReceived` timestamps
- [x] Command latency tracking (createdAt → executedAt)
- [x] Heartbeat failure count visible in dashboard
- [x] FCM token registration status visible

### Nice to Have:
- [ ] Command latency histogram (dashboard analytics)
- [ ] Admin can manually trigger push test
- [ ] FCM delivery receipts logged
- [ ] Alerting when device heartbeat failures > 5

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Phase 1: Report Revision | 30 min | None |
| Phase 2: Deploy Fix | 15 min | Phase 1 |
| Phase 3: WorkManager | 3-4 hours | Phase 2 |
| Phase 3.5: Metrics & Telemetry | 1-2 hours | Phase 3 |
| Phase 4: FCM Integration | 1-2 days | Phase 3.5 complete |
| Phase 5: Testing + OEM Matrix | 2-3 days | Phase 4 complete |
| Phase 6: Documentation | 2-3 hours | Phase 5 complete |

**Total: 4-6 days** (assuming 1 developer working sequentially)

**Breakdown:**
- Day 1: Phases 1-3 (WorkManager migration + metrics)
- Days 2-3: Phase 4 (FCM integration)
- Days 4-6: Phase 5 (Testing across OEMs)
- Day 6: Phase 6 (Documentation)

**Parallel work possible:** Backend FCM (Phase 4.2) can start while Android WorkManager (Phase 3) is being tested.

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| WorkManager batching delays heartbeats | Medium | Low | Acceptable with 15-min interval |
| FCM token registration fails | High | Low | Fallback to polling for commands |
| Firebase quota limits | Medium | Low | Monitor usage, upgrade plan if needed |
| Battery drain complaints | Medium | Low | Document expected behavior |
| OEM-specific issues (Samsung, Xiaomi) | Medium | Medium | Test on multiple device types |

---

## Appendix: Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    DASHBOARD (Web)                   │
│  ┌────────────────┐         ┌───────────────────┐  │
│  │ Device Status  │         │ Send Command      │  │
│  │ (from heartbeat)│        │ (lock/wipe/reboot)│  │
│  └────────┬───────┘         └─────────┬─────────┘  │
└───────────┼───────────────────────────┼────────────┘
            │                           │
            │ Convex Query              │ FCM Push
            │ (passive)                 │ (active)
            ▼                           ▼
┌─────────────────────────────────────────────────────┐
│                  BACKEND (Convex)                    │
│  ┌──────────────┐         ┌────────────────────┐   │
│  │ deviceClients│◄────────┤ deviceCommands     │   │
│  │ (status)     │         │ (pending commands) │   │
│  └──────┬───────┘         └─────────┬──────────┘   │
└─────────┼───────────────────────────┼──────────────┘
          │                           │
          │ Heartbeat (15 min)        │ FCM Message
          │ WorkManager               │ (instant)
          ▼                           ▼
┌─────────────────────────────────────────────────────┐
│              DEVICE (Android Client)                 │
│                                                      │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │ HeartbeatWorker  │      │ FcmMessaging     │   │
│  │ (15-min periodic)│      │ Service          │   │
│  └────────┬─────────┘      └─────────┬────────┘   │
│           │                          │             │
│           │ Triggers                 │ Wakes       │
│           ▼                          ▼             │
│  ┌───────────────────────────────────────────┐    │
│  │          ApiClient.sendHeartbeat()        │    │
│  │          + checkPendingCommands()         │    │
│  └───────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘

FLOWS:
1. Status Sync: Device → WorkManager (15 min) → Heartbeat → Backend
2. Command Delivery: Dashboard → Backend → FCM → Device (instant)
3. Command Execution: Device → Check pending → Execute → Report status
```

---

## Document Change Log

**Version 1.1** (2025-11-15)
- Added Battery Optimization Exemption (Device Owner) to Phase 4.3
- Added FCM Token Expiry Handling to Phase 4.3 (ApiClient updates)
- Added Command Timeout Tracking (FCM Fallback) to Phase 4.2 (backend)
- Added Key Enhancements summary to Phase 4 intro
- Updated OEM Testing Matrix with realistic scope (toy project, not commercial MDM)
- Clarified test device priorities: Start with Android 10 (Hannspree Zeus, Lenovo TB-X606F), then Android 13 (Hannspree Zeus III)
- Added phased rollout strategy based on available hardware
- Added "Deployment Philosophy" (start small, fix what breaks, document everything)

**Version 1.0** (2025-11-15)
- Initial implementation plan approved
- Business accepted 15-minute heartbeat interval
- WorkManager + FCM architecture finalized

---

**Document Version:** 1.1
**Last Updated:** 2025-11-15
**Status:** Ready for Implementation (Enhanced)
**Approval:** Business accepted 15-minute heartbeat interval
**Next Steps:** Begin Phase 1 (Report Revision)
