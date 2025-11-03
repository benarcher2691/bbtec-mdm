# Custom DPC Implementation Plan: Transition to Path 2

**Created:** 2025-11-03
**Last Updated:** 2025-11-03
**Status:** ⚡ IN PROGRESS - Phase 3
**Goal:** Transition from Google's Android Management API to custom Device Policy Controller (Miradore's architecture)

---

## 📊 Progress Tracker

- ✅ **Phase 1: Backend Foundation** - COMPLETE (2025-11-03)
  - Schema deployed to Convex cloud
  - All Convex functions created and tested
  - DPC API routes implemented
  - Test data created (policy + enrollment token)

- ⚡ **Phase 3: QR Code Generation** - IN PROGRESS (2025-11-03)
  - Starting with web UI before Android build
  - Custom QR code generator
  - APK uploader component
  - Policy editor UI

- ⏳ **Phase 2: Android DPC Enhancement** - PENDING
  - Deferred until after Phase 3

- ⏳ **Phase 4: Web UI Updates** - PENDING

- ⏳ **Phase 5: Testing & Deployment** - PENDING

---

## Executive Summary

Based on Miradore analysis findings, we're transitioning from **Path 1 (Google's hosted DPC)** to **Path 2 (Custom DPC)** to gain:

- ✅ **Full device control** - Our app becomes Device Owner
- ✅ **Serial number access** - No workarounds needed
- ✅ **Complete independence** - No Google API quotas/dependencies
- ✅ **Advanced features** - Kiosk mode, custom policies, etc.
- ✅ **True learning** - Understanding MDM internals

This matches your original educational goal from the ChatGPT discussion.

---

## Key Architectural Changes

### Before (Current - Path 1)
```
Device Setup Flow:
1. Factory reset device
2. Scan QR code with Google enrollment token
3. Google downloads Android Device Policy (their DPC)
4. Device enrolled in Android Management API
5. Our custom client app (companion, non-owner)
6. Limited privileges, no serial number access

Architecture:
├── Device Owner: com.google.android.apps.work.clouddpc ✓
├── Our Client: com.bbtec.mdm.client (companion app)
└── Backend: Android Management API + Convex
```

### After (Target - Path 2)
```
Device Setup Flow:
1. Factory reset device
2. Scan QR code with custom provisioning JSON
3. Android downloads OUR DPC from Convex/Vercel
4. OUR app becomes Device Owner during provisioning
5. Device registers directly with our backend
6. Full privileges, complete device control

Architecture:
├── Device Owner: com.bbtec.mdm.client (OUR APP) ✓
└── Backend: Convex only (no Google API)
```

---

## Implementation Decisions (From User Input)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Android Management API** | Complete replacement | Full independence from Google |
| **APK Hosting** | Convex file storage → GitHub Releases | Start secure, migrate later |
| **DPC Features** | Full suite (install, policies, lock/wipe, kiosk, tracking) | Complete MDM solution |
| **Web UI** | Preserve structure, remove Google references | Minimize rewrite effort |

---

## Phase 1: Backend Foundation (4-6 hours)

### 1.1 Convex Schema Updates

**File:** `convex/schema.ts`

Remove Android Management API dependencies, add custom DPC tables:

```typescript
// REMOVE (old Android Management API schema):
// - No changes to applications table (stays the same)
// - deviceClients table needs modification

// UPDATE deviceClients table:
deviceClients: defineTable({
  deviceId: v.string(),              // NOW: hardware serial number (not ANDROID_ID)
  userId: v.string(),                // Clerk user who owns device
  serialNumber: v.string(),          // Hardware serial (from Build.getSerial())
  model: v.string(),
  manufacturer: v.string(),
  androidVersion: v.string(),
  lastHeartbeat: v.number(),
  status: v.string(),                // "online", "offline"
  pingInterval: v.number(),          // minutes
  registeredAt: v.number(),

  // NEW FIELDS:
  policyId: v.optional(v.id("policies")),  // Link to applied policy
  isDeviceOwner: v.boolean(),        // Confirm DPC is Device Owner
  androidId: v.string(),             // Keep for backup reference
  apiToken: v.string(),              // Authentication token
}).index("by_device", ["deviceId"])
  .index("by_serial", ["serialNumber"])
  .index("by_user", ["userId"]),

// ADD NEW: Policies table (replaces Google's policy management)
policies: defineTable({
  name: v.string(),                  // "Default Policy", "Kiosk Policy", etc.
  userId: v.string(),                // Policy owner
  description: v.optional(v.string()),

  // Password requirements
  passwordRequired: v.boolean(),
  passwordMinLength: v.optional(v.number()),
  passwordQuality: v.optional(v.string()), // "numeric", "alphabetic", "alphanumeric", "complex"

  // Device restrictions
  cameraDisabled: v.boolean(),
  screenCaptureDisabled: v.boolean(),
  bluetoothDisabled: v.boolean(),
  usbFileTransferDisabled: v.boolean(),
  factoryResetDisabled: v.boolean(),

  // Network settings
  wifiConfigs: v.optional(v.array(v.object({
    ssid: v.string(),
    password: v.string(),
    security: v.string(),  // "WPA2", "WPA3", "OPEN"
  }))),

  // Kiosk mode
  kioskEnabled: v.boolean(),
  kioskPackageNames: v.optional(v.array(v.string())), // Allow-listed apps

  // System behavior
  statusBarDisabled: v.boolean(),
  systemAppsDisabled: v.optional(v.array(v.string())), // Package names to disable

  createdAt: v.number(),
  updatedAt: v.number(),
  isDefault: v.boolean(),            // Mark as default policy for new enrollments
}).index("by_user", ["userId"])
  .index("by_default", ["isDefault"]),

// ADD NEW: Enrollment tokens (replaces Google's enrollment tokens)
enrollmentTokens: defineTable({
  token: v.string(),                 // JWT or UUID
  userId: v.string(),                // Creator
  policyId: v.id("policies"),        // Policy to apply on enrollment

  createdAt: v.number(),
  expiresAt: v.number(),

  // Usage tracking
  used: v.boolean(),
  usedAt: v.optional(v.number()),
  usedByDeviceId: v.optional(v.string()),

  // Provisioning data
  serverUrl: v.string(),             // bbtec-mdm.vercel.app
  apkVersion: v.string(),            // Version of DPC APK to download
}).index("by_token", ["token"])
  .index("by_user", ["userId"]),

// ADD NEW: APK metadata (for DPC APK hosting)
apkMetadata: defineTable({
  version: v.string(),               // "1.0.0"
  versionCode: v.number(),           // 1, 2, 3...
  storageId: v.string(),             // Convex storage ID
  fileName: v.string(),              // "bbtec-mdm-client-1.0.0.apk"
  fileSize: v.number(),              // bytes

  signatureChecksum: v.string(),     // SHA-256 of signing certificate
  uploadedBy: v.string(),            // userId
  uploadedAt: v.number(),

  isCurrent: v.boolean(),            // Mark as current version for QR codes
  downloadCount: v.number(),         // Track downloads
}).index("by_current", ["isCurrent"]),

// KEEP: installCommands table (no changes needed)
installCommands: defineTable({
  deviceId: v.string(),
  apkUrl: v.string(),
  packageName: v.string(),
  appName: v.string(),
  status: v.string(),
  error: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
}).index("by_device", ["deviceId"])
  .index("by_status", ["status"]),

// ADD NEW: Device commands (lock, wipe, reboot, etc.)
deviceCommands: defineTable({
  deviceId: v.string(),
  commandType: v.string(),           // "lock", "wipe", "reboot", "update_policy"
  parameters: v.optional(v.object({  // Command-specific data
    message: v.optional(v.string()),  // Lock screen message
    wipeExternalStorage: v.optional(v.boolean()),
    newPolicyId: v.optional(v.id("policies")),
  })),

  status: v.string(),                // "pending", "executing", "completed", "failed"
  error: v.optional(v.string()),

  createdAt: v.number(),
  executedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
}).index("by_device", ["deviceId"])
  .index("by_status", ["status"]),
```

### 1.2 Convex Functions for Policies

**File:** `convex/policies.ts` (NEW)

```typescript
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Create a new policy
 */
export const createPolicy = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    passwordRequired: v.boolean(),
    passwordMinLength: v.optional(v.number()),
    cameraDisabled: v.boolean(),
    kioskEnabled: v.boolean(),
    kioskPackageNames: v.optional(v.array(v.string())),
    // ... all other policy fields
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    return await ctx.db.insert("policies", {
      ...args,
      userId: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false,
    })
  },
})

/**
 * Get policy by ID
 */
export const getPolicy = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.policyId)
  },
})

/**
 * List all policies for user
 */
export const listPolicies = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    return await ctx.db
      .query("policies")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect()
  },
})

/**
 * Get default policy
 */
export const getDefaultPolicy = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("policies")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first()
  },
})

/**
 * Update policy
 */
export const updatePolicy = mutation({
  args: {
    policyId: v.id("policies"),
    // ... all updatable fields
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const { policyId, ...updates } = args

    await ctx.db.patch(policyId, {
      ...updates,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Delete policy
 */
export const deletePolicy = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    await ctx.db.delete(args.policyId)
  },
})
```

### 1.3 Convex Functions for APK Storage

**File:** `convex/apkStorage.ts` (NEW)

```typescript
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Generate upload URL for APK
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Save APK metadata after upload
 */
export const saveApkMetadata = mutation({
  args: {
    version: v.string(),
    versionCode: v.number(),
    storageId: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    signatureChecksum: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Mark all existing APKs as not current
    const existing = await ctx.db
      .query("apkMetadata")
      .withIndex("by_current", (q) => q.eq("isCurrent", true))
      .collect()

    for (const apk of existing) {
      await ctx.db.patch(apk._id, { isCurrent: false })
    }

    // Insert new APK as current
    return await ctx.db.insert("apkMetadata", {
      ...args,
      uploadedBy: identity.subject,
      uploadedAt: Date.now(),
      isCurrent: true,
      downloadCount: 0,
    })
  },
})

/**
 * Get current APK for QR code generation
 */
export const getCurrentApk = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("apkMetadata")
      .withIndex("by_current", (q) => q.eq("isCurrent", true))
      .first()
  },
})

/**
 * Get APK download URL
 */
export const getApkDownloadUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * Increment download count (called by DPC during provisioning)
 */
export const incrementDownloadCount = mutation({
  args: { apkId: v.id("apkMetadata") },
  handler: async (ctx, args) => {
    const apk = await ctx.db.get(args.apkId)
    if (apk) {
      await ctx.db.patch(args.apkId, {
        downloadCount: apk.downloadCount + 1,
      })
    }
  },
})
```

### 1.4 Enrollment Token Management

**File:** `convex/enrollmentTokens.ts` (NEW)

```typescript
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Create enrollment token
 */
export const createEnrollmentToken = mutation({
  args: {
    policyId: v.id("policies"),
    expiresInSeconds: v.number(),  // Default: 3600 (1 hour)
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Generate random token (UUID style)
    const token = crypto.randomUUID()

    const now = Date.now()
    const expiresAt = now + (args.expiresInSeconds * 1000)

    return await ctx.db.insert("enrollmentTokens", {
      token,
      userId: identity.subject,
      policyId: args.policyId,
      createdAt: now,
      expiresAt,
      used: false,
      serverUrl: "https://bbtec-mdm.vercel.app",  // TODO: Get from env
      apkVersion: "1.0.0",  // TODO: Get from current APK
    })
  },
})

/**
 * Validate and consume enrollment token
 */
export const validateToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("enrollmentTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!tokenRecord) {
      return { valid: false, reason: "Token not found" }
    }

    if (tokenRecord.used) {
      return { valid: false, reason: "Token already used" }
    }

    if (Date.now() > tokenRecord.expiresAt) {
      return { valid: false, reason: "Token expired" }
    }

    return {
      valid: true,
      policyId: tokenRecord.policyId,
      serverUrl: tokenRecord.serverUrl,
    }
  },
})

/**
 * Mark token as used during device enrollment
 */
export const markTokenUsed = mutation({
  args: {
    token: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("enrollmentTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (tokenRecord && !tokenRecord.used) {
      await ctx.db.patch(tokenRecord._id, {
        used: true,
        usedAt: Date.now(),
        usedByDeviceId: args.deviceId,
      })
    }
  },
})
```

### 1.5 API Routes for DPC Communication

**File:** `src/app/api/dpc/provision/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * DPC calls this endpoint during initial provisioning
 * Returns enrollment configuration
 */
export async function POST(request: NextRequest) {
  try {
    const { enrollmentToken, deviceInfo } = await request.json()

    // Validate token
    const validation = await convex.query(api.enrollmentTokens.validateToken, {
      token: enrollmentToken,
    })

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 401 }
      )
    }

    // Get policy
    const policy = await convex.query(api.policies.getPolicy, {
      policyId: validation.policyId,
    })

    // Mark token as used
    await convex.mutation(api.enrollmentTokens.markTokenUsed, {
      token: enrollmentToken,
      deviceId: deviceInfo.serialNumber,
    })

    return NextResponse.json({
      success: true,
      policy,
      serverUrl: validation.serverUrl,
      pingInterval: 15,  // minutes
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Provisioning failed' },
      { status: 500 }
    )
  }
}
```

**File:** `src/app/api/dpc/register/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Device registration (called after provisioning)
 */
export async function POST(request: NextRequest) {
  try {
    const {
      serialNumber,
      androidId,
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner,
    } = await request.json()

    // Register device
    const deviceId = await convex.mutation(api.deviceClients.registerDevice, {
      deviceId: serialNumber,
      serialNumber,
      androidId,
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner,
    })

    return NextResponse.json({
      success: true,
      deviceId,
      apiToken: deviceId,  // For now, use deviceId as token (simplification)
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
```

**Keep existing:** `src/app/api/client/*` routes (heartbeat, commands, command-status) - these stay the same.

---

## Phase 2: Android DPC Enhancement (8-12 hours)

### 2.1 Update Device Admin Receiver for Provisioning

**File:** `android-client/app/src/main/java/com/bbtec/mdm/client/MdmDeviceAdminReceiver.kt`

```kotlin
package com.bbtec.mdm.client

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log

class MdmDeviceAdminReceiver : DeviceAdminReceiver() {

    companion object {
        private const val TAG = "MdmDeviceAdminReceiver"

        fun getComponentName(context: Context): ComponentName {
            return ComponentName(context, MdmDeviceAdminReceiver::class.java)
        }
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Device Owner mode enabled")

        // Start provisioning service
        ProvisioningService.startProvisioning(context)
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)
        Log.d(TAG, "Provisioning complete")

        // Read provisioning extras
        val extras = intent.getBundleExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE)

        if (extras != null) {
            val serverUrl = extras.getString("server_url")
            val enrollmentToken = extras.getString("enrollment_token")

            Log.d(TAG, "Server URL: $serverUrl")
            Log.d(TAG, "Enrollment token: $enrollmentToken")

            // Save to preferences
            val prefs = PreferencesManager(context)
            prefs.setServerUrl(serverUrl ?: "")
            prefs.setEnrollmentToken(enrollmentToken ?: "")
        }

        // Launch main activity
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(launchIntent)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.d(TAG, "Device Owner mode disabled")

        // Stop all services
        PollingService.stopService(context)
    }
}
```

### 2.2 Create Provisioning Service

**File:** `android-client/app/src/main/java/com/bbtec/mdm/client/ProvisioningService.kt` (NEW)

```kotlin
package com.bbtec.mdm.client

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class ProvisioningService : Service() {

    companion object {
        private const val TAG = "ProvisioningService"

        fun startProvisioning(context: Context) {
            context.startService(Intent(context, ProvisioningService::class.java))
        }
    }

    private val client = OkHttpClient()
    private val gson = Gson()

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Provisioning service started")

        Thread {
            runProvisioning()
        }.start()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun runProvisioning() {
        val prefs = PreferencesManager(this)
        val serverUrl = prefs.getServerUrl()
        val enrollmentToken = prefs.getEnrollmentToken()

        if (serverUrl.isEmpty() || enrollmentToken.isEmpty()) {
            Log.e(TAG, "Missing provisioning data")
            stopSelf()
            return
        }

        try {
            // Get serial number (now we have Device Owner privileges!)
            val serialNumber = try {
                Build.getSerial()
            } catch (e: SecurityException) {
                // Fallback to ANDROID_ID if serial fails (shouldn't happen as Device Owner)
                Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
            }

            val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)

            // Step 1: Get policy from server
            val policyJson = gson.toJson(mapOf(
                "enrollmentToken" to enrollmentToken,
                "deviceInfo" to mapOf(
                    "serialNumber" to serialNumber,
                    "model" to Build.MODEL,
                    "manufacturer" to Build.MANUFACTURER,
                    "androidVersion" to Build.VERSION.RELEASE
                )
            ))

            val provisionRequest = Request.Builder()
                .url("$serverUrl/api/dpc/provision")
                .post(policyJson.toRequestBody("application/json".toMediaType()))
                .build()

            val provisionResponse = client.newCall(provisionRequest).execute()

            if (!provisionResponse.isSuccessful) {
                Log.e(TAG, "Provisioning failed: ${provisionResponse.code}")
                stopSelf()
                return
            }

            val provisionResult = gson.fromJson(
                provisionResponse.body?.string(),
                ProvisionResult::class.java
            )

            // Step 2: Apply policy
            PolicyManager(this).applyPolicy(provisionResult.policy)

            // Step 3: Register device
            val registerJson = gson.toJson(mapOf(
                "serialNumber" to serialNumber,
                "androidId" to androidId,
                "model" to Build.MODEL,
                "manufacturer" to Build.MANUFACTURER,
                "androidVersion" to Build.VERSION.RELEASE,
                "isDeviceOwner" to true
            ))

            val registerRequest = Request.Builder()
                .url("$serverUrl/api/dpc/register")
                .post(registerJson.toRequestBody("application/json".toMediaType()))
                .build()

            val registerResponse = client.newCall(registerRequest).execute()

            if (registerResponse.isSuccessful) {
                val registerResult = gson.fromJson(
                    registerResponse.body?.string(),
                    RegisterResult::class.java
                )

                prefs.setDeviceId(registerResult.deviceId)
                prefs.setApiToken(registerResult.apiToken)
                prefs.setRegistered(true)

                Log.d(TAG, "Provisioning complete!")

                // Start polling service
                PollingService.startService(this)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Provisioning error", e)
        } finally {
            stopSelf()
        }
    }

    data class ProvisionResult(
        val success: Boolean,
        val policy: Policy,
        val serverUrl: String,
        val pingInterval: Int
    )

    data class RegisterResult(
        val success: Boolean,
        val deviceId: String,
        val apiToken: String
    )

    data class Policy(
        val name: String,
        val passwordRequired: Boolean,
        val passwordMinLength: Int?,
        val cameraDisabled: Boolean,
        val kioskEnabled: Boolean,
        val kioskPackageNames: List<String>?
        // ... all policy fields
    )
}
```

### 2.3 Create Policy Manager

**File:** `android-client/app/src/main/java/com/bbtec/mdm/client/PolicyManager.kt` (NEW)

```kotlin
package com.bbtec.mdm.client

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log

class PolicyManager(private val context: Context) {

    private val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val adminComponent = MdmDeviceAdminReceiver.getComponentName(context)

    companion object {
        private const val TAG = "PolicyManager"
    }

    fun applyPolicy(policy: ProvisioningService.Policy) {
        Log.d(TAG, "Applying policy: ${policy.name}")

        try {
            // Password requirements
            if (policy.passwordRequired) {
                dpm.setPasswordQuality(
                    adminComponent,
                    DevicePolicyManager.PASSWORD_QUALITY_NUMERIC
                )
                policy.passwordMinLength?.let { minLength ->
                    dpm.setPasswordMinimumLength(adminComponent, minLength)
                }
            } else {
                dpm.setPasswordQuality(
                    adminComponent,
                    DevicePolicyManager.PASSWORD_QUALITY_UNSPECIFIED
                )
            }

            // Camera restriction
            dpm.setCameraDisabled(adminComponent, policy.cameraDisabled)

            // Kiosk mode
            if (policy.kioskEnabled && !policy.kioskPackageNames.isNullOrEmpty()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    dpm.setLockTaskPackages(
                        adminComponent,
                        policy.kioskPackageNames.toTypedArray()
                    )
                }
            }

            // TODO: Add more policy enforcement
            // - Screen capture
            // - Bluetooth
            // - USB file transfer
            // - WiFi configs
            // - System apps disable

            Log.d(TAG, "Policy applied successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Error applying policy", e)
        }
    }

    /**
     * Lock device with custom message
     */
    fun lockDevice(message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            dpm.lockNow()
        }
    }

    /**
     * Factory reset / wipe device
     */
    fun wipeDevice(wipeExternalStorage: Boolean = false) {
        val flags = if (wipeExternalStorage) {
            DevicePolicyManager.WIPE_EXTERNAL_STORAGE
        } else {
            0
        }
        dpm.wipeData(flags)
    }

    /**
     * Reboot device
     */
    fun rebootDevice() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            dpm.reboot(adminComponent)
        }
    }

    /**
     * Enable/disable kiosk mode
     */
    fun setKioskMode(enabled: Boolean, packageNames: List<String>) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (enabled) {
                dpm.setLockTaskPackages(adminComponent, packageNames.toTypedArray())
            } else {
                dpm.setLockTaskPackages(adminComponent, emptyArray())
            }
        }
    }
}
```

### 2.4 Update Device Registration

**File:** `android-client/app/src/main/java/com/bbtec/mdm/client/DeviceRegistration.kt`

Update to use serial number (now accessible as Device Owner):

```kotlin
package com.bbtec.mdm.client

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class DeviceRegistration(private val context: Context) {

    private val client = OkHttpClient()
    private val gson = Gson()
    private val prefsManager = PreferencesManager(context)

    companion object {
        private const val TAG = "DeviceRegistration"
    }

    fun registerDevice() {
        Thread {
            try {
                // NOW WE CAN ACCESS SERIAL NUMBER!
                val serialNumber = Build.getSerial()
                val androidId = Settings.Secure.getString(
                    context.contentResolver,
                    Settings.Secure.ANDROID_ID
                )

                Log.d(TAG, "Registering with serial: $serialNumber")

                val json = gson.toJson(mapOf(
                    "serialNumber" to serialNumber,
                    "androidId" to androidId,
                    "model" to Build.MODEL,
                    "manufacturer" to Build.MANUFACTURER,
                    "androidVersion" to Build.VERSION.RELEASE,
                    "isDeviceOwner" to true,
                    "registeredAt" to System.currentTimeMillis()
                ))

                val serverUrl = prefsManager.getServerUrl()
                val request = Request.Builder()
                    .url("$serverUrl/api/dpc/register")
                    .post(json.toRequestBody("application/json".toMediaType()))
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val result = gson.fromJson(
                            response.body?.string(),
                            RegisterResult::class.java
                        )

                        prefsManager.setDeviceId(result.deviceId)
                        prefsManager.setApiToken(result.apiToken)
                        prefsManager.setRegistered(true)

                        Log.d(TAG, "Registration successful")
                    } else {
                        Log.e(TAG, "Registration failed: ${response.code}")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Registration error", e)
            }
        }.start()
    }

    data class RegisterResult(
        val success: Boolean,
        val deviceId: String,
        val apiToken: String
    )
}
```

### 2.5 Update PreferencesManager

**File:** `android-client/app/src/main/java/com/bbtec/mdm/client/PreferencesManager.kt`

Add new fields:

```kotlin
package com.bbtec.mdm.client

import android.content.Context

class PreferencesManager(context: Context) {

    private val prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE)

    // Existing methods...
    fun isRegistered(): Boolean = prefs.getBoolean("registered", false)
    fun setRegistered(registered: Boolean) = prefs.edit().putBoolean("registered", registered).apply()

    fun getDeviceId(): String = prefs.getString("device_id", "") ?: ""
    fun setDeviceId(id: String) = prefs.edit().putString("device_id", id).apply()

    fun getLastHeartbeat(): Long = prefs.getLong("last_heartbeat", 0)
    fun setLastHeartbeat(timestamp: Long) = prefs.edit().putLong("last_heartbeat", timestamp).apply()

    fun getPingInterval(): Int = prefs.getInt("ping_interval", 15)
    fun setPingInterval(minutes: Int) = prefs.edit().putInt("ping_interval", minutes).apply()

    // NEW: Server URL from provisioning
    fun getServerUrl(): String = prefs.getString("server_url", "https://bbtec-mdm.vercel.app") ?: "https://bbtec-mdm.vercel.app"
    fun setServerUrl(url: String) = prefs.edit().putString("server_url", url).apply()

    // NEW: Enrollment token from QR code
    fun getEnrollmentToken(): String = prefs.getString("enrollment_token", "") ?: ""
    fun setEnrollmentToken(token: String) = prefs.edit().putString("enrollment_token", token).apply()

    // NEW: API token from registration
    fun getApiToken(): String = prefs.getString("api_token", "") ?: ""
    fun setApiToken(token: String) = prefs.edit().putString("api_token", token).apply()
}
```

### 2.6 Update AndroidManifest.xml

**File:** `android-client/app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />

    <!-- NEW: Required for Device Owner capabilities -->
    <uses-permission android:name="android.permission.MANAGE_DEVICE_ADMINS" />
    <uses-permission android:name="android.permission.MANAGE_PROFILE_AND_DEVICE_OWNERS" />

    <application
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:allowBackup="true"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light">

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
                <!-- NEW: Provisioning complete action -->
                <action android:name="android.app.action.PROFILE_PROVISIONING_COMPLETE" />
            </intent-filter>
        </receiver>

        <!-- NEW: Provisioning service -->
        <service
            android:name=".ProvisioningService"
            android:enabled="true"
            android:exported="false" />

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

        <receiver
            android:name=".ApkInstaller$InstallReceiver"
            android:exported="false" />

    </application>

</manifest>
```

### 2.7 Update device_admin.xml

**File:** `android-client/app/src/main/res/xml/device_admin.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <!-- Existing -->
        <force-lock />
        <wipe-data />

        <!-- NEW: Device Owner policies -->
        <reset-password />
        <limit-password />
        <watch-login />
        <disable-camera />
        <disable-keyguard-features />
        <expire-password />
        <encrypted-storage />
    </uses-policies>
</device-admin>
```

---

## Phase 3: QR Code Generation (3-4 hours)

### 3.1 Create Enrollment Action

**File:** `src/app/actions/enrollment.ts` (NEW - replaces android-management.ts)

```typescript
"use server"

import { auth } from '@clerk/nextjs/server'
import QRCode from 'qrcode'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Create custom enrollment QR code
 * Replaces Android Management API token generation
 */
export async function createEnrollmentQRCode(policyId: string, duration: number = 3600) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    // Get current APK metadata
    const currentApk = await convex.query(api.apkStorage.getCurrentApk)

    if (!currentApk) {
      return {
        success: false,
        error: 'No DPC APK uploaded. Please upload the client APK first.',
      }
    }

    // Get APK download URL from Convex storage
    const apkUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId: currentApk.storageId,
    })

    // Create enrollment token
    const tokenId = await convex.mutation(api.enrollmentTokens.createEnrollmentToken, {
      policyId,
      expiresInSeconds: duration,
    })

    const token = await convex.query(api.enrollmentTokens.getToken, { tokenId })

    // Build Android provisioning JSON
    const provisioningData = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/.MdmDeviceAdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": apkUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": currentApk.signatureChecksum,
      "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        "server_url": process.env.NEXT_PUBLIC_APP_URL || "https://bbtec-mdm.vercel.app",
        "enrollment_token": token.token,
      }
    }

    // Generate QR code from JSON
    const qrContent = JSON.stringify(provisioningData)
    const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H',  // High error correction for complex data
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })

    return {
      success: true,
      token: token.token,
      qrCode: qrCodeDataUrl,
      expirationTimestamp: new Date(token.expiresAt).toISOString(),
      apkVersion: currentApk.version,
    }
  } catch (error) {
    console.error('Error creating enrollment QR code:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create enrollment QR code',
    }
  }
}

/**
 * List enrolled devices (from Convex, not Google API)
 */
export async function listDevices() {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    const devices = await convex.query(api.deviceClients.listDevices)

    return {
      success: true,
      devices: devices || [],
    }
  } catch (error) {
    console.error('Error listing devices:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list devices',
      devices: [],
    }
  }
}

/**
 * Get device details
 */
export async function getDevice(deviceId: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    const device = await convex.query(api.deviceClients.getDevice, { deviceId })

    return {
      success: true,
      device,
    }
  } catch (error) {
    console.error('Error getting device:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get device',
    }
  }
}

/**
 * Issue device command (lock, wipe, reboot)
 */
export async function issueDeviceCommand(
  deviceId: string,
  commandType: 'lock' | 'wipe' | 'reboot' | 'update_policy',
  parameters?: any
) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    await convex.mutation(api.deviceCommands.createCommand, {
      deviceId,
      commandType,
      parameters,
    })

    return {
      success: true,
      message: `Command ${commandType} queued successfully`,
    }
  } catch (error) {
    console.error('Error issuing device command:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to issue device command',
    }
  }
}

/**
 * Delete device
 */
export async function deleteDevice(deviceId: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    await convex.mutation(api.deviceClients.deleteDevice, { deviceId })

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error deleting device:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete device',
    }
  }
}
```

### 3.2 Create APK Signature Utility

**File:** `src/lib/apk-signature.ts` (NEW)

```typescript
/**
 * Calculate APK signature checksum for provisioning
 *
 * This needs to match the signing certificate of your APK.
 *
 * To get the checksum:
 * 1. Build signed APK: ./gradlew assembleRelease
 * 2. Extract cert: keytool -list -v -keystore <keystore> -alias <alias>
 * 3. Copy SHA-256 fingerprint
 * 4. Convert to base64 (this utility does it)
 */

export function hexToBase64(hexString: string): string {
  // Remove colons and spaces from hex string
  const cleanHex = hexString.replace(/[:\s]/g, '')

  // Convert hex to bytes
  const bytes = []
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes.push(parseInt(cleanHex.substr(i, 2), 16))
  }

  // Convert bytes to base64
  const binary = String.fromCharCode.apply(null, bytes)
  return btoa(binary)
}

/**
 * Example usage:
 *
 * const sha256Hex = "A1:B2:C3:D4:E5:F6:..." // From keytool output
 * const checksum = hexToBase64(sha256Hex)
 *
 * Use 'checksum' in provisioning QR code
 */
```

### 3.3 Update QR Code Generator Component

**File:** `src/components/qr-code-generator.tsx`

Replace `createEnrollmentToken` import:

```typescript
// OLD:
// import { createEnrollmentToken, listDevices } from "@/app/actions/android-management"

// NEW:
import { createEnrollmentQRCode, listDevices } from "@/app/actions/enrollment"
```

Update `handleGenerateToken` function:

```typescript
const handleGenerateToken = async () => {
  setLoading(true)
  setError(null)
  setEnrolledDevice(null)

  try {
    // Get current device count
    const devicesResult = await listDevices()
    if (devicesResult.success) {
      setDeviceCountBefore(devicesResult.devices.length)
    }

    // Get default policy ID (or let user select)
    const defaultPolicyId = "..." // TODO: Query default policy

    // Generate custom QR code (not Google token)
    const result = await createEnrollmentQRCode(defaultPolicyId, 3600)

    if (result.success) {
      setTokenData({
        token: result.token || '',
        qrCode: result.qrCode || '',
        expirationTimestamp: result.expirationTimestamp || '',
      })

      // Start polling for new device enrollment
      setWaitingForEnrollment(true)
      startPollingForEnrollment()
    } else {
      setError(result.error || 'Failed to create enrollment QR code')
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'An error occurred')
  } finally {
    setLoading(false)
  }
}
```

---

## Phase 4: Web UI Updates (4-6 hours)

### 4.1 Create APK Uploader Component

**File:** `src/components/apk-uploader.tsx` (NEW)

```typescript
"use client"

import { useState } from "react"
import { useAction, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Check, AlertCircle } from "lucide-react"

export function ApkUploader() {
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateUploadUrl = useMutation(api.apkStorage.generateUploadUrl)
  const saveMetadata = useMutation(api.apkStorage.saveApkMetadata)

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUploading(true)
    setError(null)
    setSuccess(false)

    const form = e.currentTarget
    const fileInput = form.elements.namedItem('apk') as HTMLInputElement
    const versionInput = form.elements.namedItem('version') as HTMLInputElement
    const checksumInput = form.elements.namedItem('checksum') as HTMLInputElement

    const file = fileInput.files?.[0]
    if (!file) {
      setError('Please select an APK file')
      setUploading(false)
      return
    }

    try {
      // Step 1: Get upload URL
      const uploadUrl = await generateUploadUrl()

      // Step 2: Upload file
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      const { storageId } = await uploadResponse.json()

      // Step 3: Save metadata
      await saveMetadata({
        version: versionInput.value,
        versionCode: parseInt(versionInput.value.split('.').join('')),
        storageId,
        fileName: file.name,
        fileSize: file.size,
        signatureChecksum: checksumInput.value,
      })

      setSuccess(true)
      form.reset()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Upload DPC APK</h3>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <Label htmlFor="apk">APK File</Label>
          <Input
            id="apk"
            name="apk"
            type="file"
            accept=".apk"
            disabled={uploading}
          />
        </div>

        <div>
          <Label htmlFor="version">Version (e.g., 1.0.0)</Label>
          <Input
            id="version"
            name="version"
            type="text"
            placeholder="1.0.0"
            disabled={uploading}
          />
        </div>

        <div>
          <Label htmlFor="checksum">Signature Checksum (SHA-256 base64)</Label>
          <Input
            id="checksum"
            name="checksum"
            type="text"
            placeholder="Get from: keytool -list -v -keystore ..."
            disabled={uploading}
          />
        </div>

        <Button type="submit" disabled={uploading}>
          {uploading ? (
            <>Uploading...</>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload APK
            </>
          )}
        </Button>
      </form>

      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-900">APK uploaded successfully!</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-900">{error}</span>
        </div>
      )}
    </div>
  )
}
```

### 4.2 Create Policy Editor Component

**File:** `src/components/policy-editor.tsx` (NEW)

```typescript
"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

export function PolicyEditor() {
  const [name, setName] = useState("")
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [passwordMinLength, setPasswordMinLength] = useState(4)
  const [cameraDisabled, setCameraDisabled] = useState(false)
  const [kioskEnabled, setKioskEnabled] = useState(false)

  const createPolicy = useMutation(api.policies.createPolicy)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await createPolicy({
      name,
      passwordRequired,
      passwordMinLength: passwordRequired ? passwordMinLength : undefined,
      cameraDisabled,
      kioskEnabled,
      kioskPackageNames: kioskEnabled ? [] : undefined,
      // ... other fields with defaults
    })

    // Reset form
    setName("")
    setPasswordRequired(false)
    setCameraDisabled(false)
    setKioskEnabled(false)
  }

  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Create Policy</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Policy Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Default Policy"
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <Label htmlFor="password">Require Password</Label>
          <Switch
            id="password"
            checked={passwordRequired}
            onCheckedChange={setPasswordRequired}
          />
        </div>

        {passwordRequired && (
          <div>
            <Label htmlFor="minLength">Minimum Length</Label>
            <Input
              id="minLength"
              type="number"
              value={passwordMinLength}
              onChange={(e) => setPasswordMinLength(parseInt(e.target.value))}
            />
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <Label htmlFor="camera">Disable Camera</Label>
          <Switch
            id="camera"
            checked={cameraDisabled}
            onCheckedChange={setCameraDisabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="kiosk">Enable Kiosk Mode</Label>
          <Switch
            id="kiosk"
            checked={kioskEnabled}
            onCheckedChange={setKioskEnabled}
          />
        </div>

        <Button type="submit">Create Policy</Button>
      </form>
    </div>
  )
}
```

### 4.3 Update Device List Table

**File:** `src/components/device-list-table.tsx`

Remove Android Management API references, use Convex queries:

```typescript
// OLD:
// const devices = await listDevices() // from android-management.ts

// NEW:
const devices = useQuery(api.deviceClients.listDevices)

// Update device object structure to match new schema
// Remove Google-specific fields (hardwareInfo.*, etc.)
// Use serialNumber, model, manufacturer from deviceClients table
```

### 4.4 Update Device Detail View

**File:** `src/components/device-detail-view.tsx`

Remove Android Management API dependencies:

```typescript
// Remove Google API fields
// Update to use Convex deviceClients data
// Serial number now directly available (no lookup needed!)

const device = useQuery(api.deviceClients.getDevice, { deviceId })

// Display fields:
// - device.serialNumber (now available!)
// - device.model
// - device.manufacturer
// - device.androidVersion
// - device.lastHeartbeat
// - device.status
```

---

## Phase 5: Testing & Deployment (2-4 hours)

### 5.1 Build Signed Release APK

**Use Android Studio GUI (not CLI):**

1. Open Android Studio
2. Open `android-client` project
3. Build → Generate Signed Bundle / APK
4. Select APK
5. Create new keystore (or use existing)
6. Fill in keystore details (save passwords to password manager!)
7. Build release APK

**Critical:** Backup keystore file and passwords immediately!

### 5.2 Get Signature Checksum

**Use Android Studio GUI:**

1. Tools → App Links Assistant
2. Click "Open Digital Asset Links File Generator"
3. Copy SHA-256 fingerprint
4. Use `src/lib/apk-signature.ts` utility to convert to base64

### 5.3 Upload APK via Web UI

**Use Convex Dashboard first (per your principle):**

1. Open Convex Dashboard: dashboard.convex.dev
2. Navigate to Files/Storage section
3. Manually upload APK to test
4. Verify storage ID is generated
5. Then use web UI APK uploader component

### 5.4 Generate QR Code

1. Create default policy via web UI
2. Upload APK via web UI
3. Click "Generate Enrollment QR Code"
4. Verify QR contains custom provisioning JSON (not Google token)

### 5.5 Test Provisioning Flow

1. **Factory reset test device**
2. **During setup wizard:**
   - Tap screen 6 times to trigger QR scanner
   - Connect to WiFi
   - Scan custom QR code
3. **Observe:**
   - Android downloads DPC APK from Convex
   - Installs and sets as Device Owner
   - DPC contacts backend for provisioning
   - Policy applied
   - Device appears in web UI

### 5.6 Verify Features

- [ ] Device shows in web UI with serial number
- [ ] Connection status shows "online" (green)
- [ ] Heartbeat updates work
- [ ] Lock device command works
- [ ] APK installation queue works
- [ ] Policy enforcement (camera disabled if set)
- [ ] Kiosk mode (if enabled)

---

## Migration Strategy

### Option A: Clean Slate (Recommended)
1. Create new Convex deployment: `npx convex dev --project bbtec-mdm-v2`
2. Deploy new schema
3. Test everything in parallel with old system
4. Once verified, switch production to new system
5. Delete old Convex deployment

### Option B: In-Place Migration
1. Export existing device data from Convex
2. Run schema migration
3. Update all code
4. Re-enroll devices (factory reset required anyway)

**Recommendation:** Option A (clean slate) is safer for learning.

---

## Web Dashboard Usage Plan (Per Your Principle)

| Task | Tool | Why |
|------|------|-----|
| **Create Convex storage bucket** | Convex Dashboard | Visual confirmation bucket exists |
| **Test APK upload** | Convex Dashboard → Files | Verify upload works before automating |
| **Monitor file uploads** | Convex Dashboard | See actual storage usage, IDs |
| **Create signing keystore** | Android Studio GUI | Guided workflow, less error-prone |
| **Get signature checksum** | Android Studio GUI | Built-in tools, visual feedback |
| **Deploy schema changes** | Convex Dashboard → Data | Review schema before applying |
| **Environment variables** | Vercel Dashboard | Visual review before saving |
| **Test policy creation** | Convex Dashboard → Data | Manually create first policy to understand structure |

**Graduate to CLI:**
- `npx convex dev` (daily workflow)
- `./gradlew assembleDebug` (after keystore setup working)
- Git commands (after understanding flow)

---

## Success Criteria

### MVP Complete When:
✅ Factory reset device can scan custom QR code
✅ DPC APK downloads from Convex during provisioning
✅ Device becomes Device Owner (our app, not Google's)
✅ Serial number accessible and displayed in web UI
✅ Policy applied automatically (password, camera, etc.)
✅ Heartbeat/online tracking works
✅ Silent APK installation works
✅ Lock/wipe commands work
✅ No Android Management API dependencies
✅ Complete independence from Google

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Backend Setup | 4-6 hours | 4-6 hours |
| Phase 2: Android DPC | 8-12 hours | 12-18 hours |
| Phase 3: QR Generation | 3-4 hours | 15-22 hours |
| Phase 4: Web UI Updates | 4-6 hours | 19-28 hours |
| Phase 5: Testing | 2-4 hours | 21-32 hours |
| **Total** | **21-32 hours** | **3-4 working days** |

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Create Convex deployment (via dashboard)
3. ⏳ Phase 1: Backend setup
4. ⏳ Phase 2: Android DPC
5. ⏳ Phase 3: QR generation
6. ⏳ Phase 4: Web UI
7. ⏳ Phase 5: Testing

---

## References

- Android Device Owner Provisioning: https://developer.android.com/work/dpc/custom-provisioning
- DevicePolicyManager API: https://developer.android.com/reference/android/app/admin/DevicePolicyManager
- Convex File Storage: https://docs.convex.dev/file-storage
- QR Code Provisioning Format: https://developer.android.com/work/dpc/qr-code

---

## Lessons from Miradore Analysis

1. **Device Owner = Full Control:** Architecture decision affects all capabilities
2. **Serial Number Access:** Only Device Owner can call `Build.getSerial()`
3. **Independence Matters:** Custom DPC = no Google API quotas/restrictions
4. **Provisioning is Key:** QR code format determines who becomes Device Owner
5. **Learning Value:** Building your own DPC teaches MDM internals deeply

This is the path to true MDM understanding! 🚀
---

## 📝 Session Notes

### Session 1: 2025-11-03 - Backend Foundation Complete

**Accomplished:**
- ✅ Analyzed Miradore MDM client architecture
- ✅ Created comprehensive findings document (planning/miradore-analysis/FINDINGS.md)
- ✅ Decided on Path 2 (Custom DPC) approach
- ✅ Updated Convex schema with 4 new tables (policies, enrollmentTokens, apkMetadata, deviceCommands)
- ✅ Created 5 Convex function files (policies.ts, apkStorage.ts, enrollmentTokens.ts, deviceCommands.ts, updated deviceClients.ts)
- ✅ Created 2 DPC API routes (/api/dpc/provision, /api/dpc/register)
- ✅ Deployed to Convex cloud (expert-lemur-691)
- ✅ Cleaned existing test data (7 old records)
- ✅ Created test policy and enrollment token via Convex Dashboard

**Key Learnings:**
- Miradore's app IS the Device Owner (fundamentally different architecture)
- Serial number access requires Device Owner privileges
- Convex doesn't accept null - optional fields must be omitted
- Web dashboard first approach works well for schema exploration

**Next Session:**
- Start Phase 3: QR Code Generation
- Build custom enrollment QR generator
- Create APK uploader UI
- Update web components
