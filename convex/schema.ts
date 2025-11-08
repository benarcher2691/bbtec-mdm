import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Database schema for bbtec-mdm
 *
 * Note: Device data comes from Android Management API (not stored here)
 * This schema is for user-specific customizations and app data
 */

export default defineSchema({
  // Custom device tags and notes
  deviceNotes: defineTable({
    deviceId: v.string(), // Android device ID
    userId: v.string(),   // Clerk user ID
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
    customName: v.optional(v.string()),
  }).index("by_device", ["deviceId"])
    .index("by_user", ["userId"]),

  // User preferences
  userPreferences: defineTable({
    userId: v.string(), // Clerk user ID
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    defaultPolicyId: v.optional(v.string()),
    notificationsEnabled: v.boolean(),
  }).index("by_user", ["userId"]),

  // Audit log for actions
  auditLog: defineTable({
    userId: v.string(),
    action: v.string(), // "create_policy", "enroll_device", "delete_device", etc.
    resourceType: v.string(), // "device", "policy", "token"
    resourceId: v.string(),
    metadata: v.optional(v.object({
      deviceName: v.optional(v.string()),
      policyName: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
    })),
    timestamp: v.number(),
  }).index("by_user", ["userId"])
    .index("by_resource", ["resourceType", "resourceId"]),

  // Uploaded applications (APK files)
  applications: defineTable({
    userId: v.string(),          // Clerk user ID who uploaded
    name: v.string(),             // App display name
    packageName: v.string(),      // Android package name (e.g., com.example.app)
    versionName: v.string(),      // Version string (e.g., "1.0.0")
    versionCode: v.number(),      // Version code number
    fileSize: v.number(),         // File size in bytes
    storageId: v.id("_storage"),  // Convex file storage ID
    uploadedAt: v.number(),       // Timestamp
    description: v.optional(v.string()),
  }).index("by_user", ["userId"])
    .index("by_package", ["packageName"]),

  // Physical devices (survives factory reset and re-enrollment)
  devices: defineTable({
    // Device matching IDs
    ssaId: v.optional(v.string()),         // App-scoped ANDROID_ID (primary matcher)
    serialNumber: v.optional(v.string()),  // Hardware serial or "0" sentinel (secondary matcher)

    // Device metadata
    brand: v.string(),
    model: v.string(),
    manufacturer: v.string(),
    buildFingerprint: v.optional(v.string()), // Build.FINGERPRINT from first enrollment

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ssaid", ["ssaId"])
    .index("by_serial", ["serialNumber"]),

  // Registered client devices (NOW: Full device data, our DPC is Device Owner)
  // This table represents ENROLLMENTS - a device can be enrolled multiple times
  deviceClients: defineTable({
    // Enrollment identifiers (v0.0.34+: three separate IDs, never mixed!)
    enrollmentId: v.optional(v.string()),    // DPM.enrollmentSpecificId (unique per enrollment)
    ssaId: v.optional(v.string()),           // App-scoped ANDROID_ID (for device matching)
    serialNumber: v.optional(v.string()),    // Hardware serial or "0" sentinel

    // Legacy fields (keep for backward compatibility with older enrollments)
    deviceId: v.string(),              // Legacy: Was serial number, now enrollmentId
    androidId: v.optional(v.string()), // Legacy: Old Android ID field

    // Link to physical device
    physicalDeviceId: v.optional(v.id("devices")), // FK to devices table

    userId: v.string(),                // Clerk user who owns device
    companyUserId: v.optional(v.id("companyUsers")), // Company user assignment
    model: v.string(),
    manufacturer: v.string(),
    androidVersion: v.string(),
    lastHeartbeat: v.number(),
    status: v.string(),                // "online", "offline"
    pingInterval: v.number(),          // minutes
    registeredAt: v.number(),

    // NEW: Device Owner specific fields
    policyId: v.optional(v.id("policies")),  // Applied policy
    isDeviceOwner: v.boolean(),        // Confirm our DPC is Device Owner
    apiToken: v.string(),              // Authentication token for device API calls
  }).index("by_device", ["deviceId"])
    .index("by_enrollment_id", ["enrollmentId"])
    .index("by_serial", ["serialNumber"])
    .index("by_user", ["userId"])
    .index("by_token", ["apiToken"])
    .index("by_company_user", ["companyUserId"])
    .index("by_physical_device", ["physicalDeviceId"]),

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

  // NEW: Device policies (replaces Android Management API policies)
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
      password: v.optional(v.string()),
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

  // NEW: Enrollment tokens (replaces Android Management API tokens)
  enrollmentTokens: defineTable({
    token: v.string(),                 // UUID
    userId: v.string(),                // Creator
    policyId: v.id("policies"),        // Policy to apply on enrollment
    companyUserId: v.optional(v.id("companyUsers")), // Company user assignment

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

  // NEW: APK metadata for DPC hosting
  apkMetadata: defineTable({
    version: v.string(),               // "1.0.0"
    versionCode: v.number(),           // 1, 2, 3...
    storageId: v.id("_storage"),       // Convex storage ID
    fileName: v.string(),              // "bbtec-mdm-client-1.0.0.apk"
    fileSize: v.number(),              // bytes

    signatureChecksum: v.string(),     // SHA-256 of signing certificate (base64)
    uploadedBy: v.string(),            // userId
    uploadedAt: v.number(),

    isCurrent: v.boolean(),            // Mark as current version for QR codes
    downloadCount: v.number(),         // Track downloads
  }).index("by_current", ["isCurrent"]),

  // NEW: Device commands (lock, wipe, reboot, etc.)
  deviceCommands: defineTable({
    deviceId: v.string(),
    commandType: v.string(),           // "lock", "wipe", "reboot", "update_policy"
    parameters: v.optional(v.any()),   // Command-specific data (using any for flexibility)

    status: v.string(),                // "pending", "executing", "completed", "failed"
    error: v.optional(v.string()),

    createdAt: v.number(),
    executedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_device", ["deviceId"])
    .index("by_status", ["status"]),

  // Company users (customers/organizations)
  companyUsers: defineTable({
    companyName: v.string(),
    contactPersonName: v.string(),
    contactPersonEmail: v.string(),    // Unique identifier
    ownerId: v.string(),               // Clerk user ID who created this
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["contactPersonEmail"])
    .index("by_owner", ["ownerId"]),
});
