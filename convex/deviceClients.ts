import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Register a new device client (NEW: Device Owner model)
 * Now we store full device metadata since we ARE the Device Owner
 */
export const registerDevice = mutation({
  args: {
    deviceId: v.string(),         // Serial number (primary)
    serialNumber: v.string(),
    androidId: v.string(),
    model: v.string(),
    manufacturer: v.string(),
    androidVersion: v.string(),
    isDeviceOwner: v.boolean(),
    userId: v.optional(v.string()), // Optional, can be assigned later
    policyId: v.optional(v.id("policies")), // Optional, for DPC enrollment
    companyUserId: v.optional(v.id("companyUsers")), // Optional, company user assignment
  },
  handler: async (ctx, args) => {
    // Check if device already registered (by serial number)
    const existing = await ctx.db
      .query("deviceClients")
      .withIndex("by_serial", (q) => q.eq("serialNumber", args.serialNumber))
      .first()

    if (existing) {
      // Update existing device registration
      const apiToken = existing.apiToken || crypto.randomUUID()

      await ctx.db.patch(existing._id, {
        lastHeartbeat: Date.now(),
        status: "online",
        apiToken,
        model: args.model,
        manufacturer: args.manufacturer,
        androidVersion: args.androidVersion,
        isDeviceOwner: args.isDeviceOwner,
        registeredAt: Date.now(), // Update registration timestamp
        ...(args.policyId ? { policyId: args.policyId } : {}),
        ...(args.companyUserId ? { companyUserId: args.companyUserId } : {}),
      })

      // Cancel any pending device commands (wipe/lock/reboot) from previous enrollment
      // If device is re-registering, it means it survived/was wiped/rebooted, so old commands are stale
      const pendingCommands = await ctx.db
        .query("deviceCommands")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect()

      for (const command of pendingCommands) {
        await ctx.db.patch(command._id, {
          status: "failed",
          error: "Device re-registered - command cancelled",
          completedAt: Date.now(),
        })
      }

      return {
        deviceClientId: existing._id,
        apiToken,
      }
    }

    // Generate secure API token for new device
    const apiToken = crypto.randomUUID()

    // Get user ID from context if not provided (for web-initiated enrollments)
    let userId = args.userId
    if (!userId) {
      const identity = await ctx.auth.getUserIdentity()
      userId = identity?.subject || "system" // Fallback to "system" for unassigned devices
    }

    // New registration
    const deviceClientId = await ctx.db.insert("deviceClients", {
      deviceId: args.serialNumber,     // Use serial number as primary ID
      userId,
      serialNumber: args.serialNumber,
      androidId: args.androidId,
      model: args.model,
      manufacturer: args.manufacturer,
      androidVersion: args.androidVersion,
      lastHeartbeat: Date.now(),
      status: "online",
      pingInterval: 15,
      registeredAt: Date.now(),
      isDeviceOwner: args.isDeviceOwner,
      apiToken,
      ...(args.policyId ? { policyId: args.policyId } : {}),
      ...(args.companyUserId ? { companyUserId: args.companyUserId } : {}),
    })

    return {
      deviceClientId,
      apiToken,
    }
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

/**
 * Get device client by Android device ID (for UI)
 */
export const getByAndroidDeviceId = query({
  args: {
    androidDeviceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check auth
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    return await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.androidDeviceId))
      .first()
  },
})

/**
 * Update ping interval for a device (web dashboard / user-initiated)
 */
export const updatePingInterval = mutation({
  args: {
    deviceId: v.string(),
    pingInterval: v.number(),
  },
  handler: async (ctx, args) => {
    // Check auth
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    // Validate interval is between 1 and 180 minutes
    if (args.pingInterval < 1 || args.pingInterval > 180) {
      throw new Error("Ping interval must be between 1 and 180 minutes")
    }

    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first()

    if (!device) {
      throw new Error("Device not found")
    }

    await ctx.db.patch(device._id, {
      pingInterval: args.pingInterval,
    })

    return { success: true }
  },
})

/**
 * Update ping interval for a device (device-initiated via API)
 * No user auth required - device already authenticated via API token
 */
export const updatePingIntervalFromDevice = mutation({
  args: {
    deviceId: v.string(),
    pingInterval: v.number(),
  },
  handler: async (ctx, args) => {
    // No user auth check - called from API route that already validated device token

    // Validate interval is between 1 and 180 minutes
    if (args.pingInterval < 1 || args.pingInterval > 180) {
      throw new Error("Ping interval must be between 1 and 180 minutes")
    }

    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first()

    if (!device) {
      throw new Error("Device not found")
    }

    await ctx.db.patch(device._id, {
      pingInterval: args.pingInterval,
      lastHeartbeat: Date.now(), // Update timestamp to trigger reactive updates
    })

    return { success: true }
  },
})

/**
 * Validate API token and return device client info
 * Used by API routes to authenticate device requests
 */
export const validateToken = query({
  args: {
    apiToken: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_token", (q) => q.eq("apiToken", args.apiToken))
      .first()

    if (!device) {
      return null
    }

    return {
      deviceId: device.deviceId,
      pingInterval: device.pingInterval,
      _id: device._id,
    }
  },
})

/**
 * List all devices for current user (NEW)
 */
export const listDevices = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const devices = await ctx.db
      .query("deviceClients")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect()

    // Enrich with company user data
    return await Promise.all(
      devices.map(async (device) => {
        let companyUser = null
        if (device.companyUserId) {
          companyUser = await ctx.db.get(device.companyUserId)
        }
        return {
          ...device,
          companyName: companyUser?.companyName || null,
        }
      })
    )
  },
})

/**
 * Get device by ID (NEW)
 */
export const getDevice = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first()

    if (!device) return null

    // Enrich with company user data
    let companyUser = null
    if (device.companyUserId) {
      companyUser = await ctx.db.get(device.companyUserId)
    }

    return {
      ...device,
      companyName: companyUser?.companyName || null,
    }
  },
})

/**
 * Get device by serial number (NEW)
 */
export const getBySerialNumber = query({
  args: { serialNumber: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db
      .query("deviceClients")
      .withIndex("by_serial", (q) => q.eq("serialNumber", args.serialNumber))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first()
  },
})

/**
 * Delete a device (NEW)
 * If withWipe is true, sends a factory reset command and keeps device for command delivery
 * If withWipe is false, immediately removes from database
 */
export const deleteDevice = mutation({
  args: {
    deviceId: v.string(),
    withWipe: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first()

    if (!device) {
      throw new Error("Device not found or unauthorized")
    }

    if (args.withWipe) {
      // Create wipe command - device will receive it on next check-in
      await ctx.db.insert("deviceCommands", {
        deviceId: args.deviceId,
        commandType: "wipe",
        parameters: undefined,
        status: "pending",
        createdAt: Date.now(),
      })

      // DON'T delete device yet - it needs to stay in DB to:
      // 1. Authenticate on next check-in
      // 2. Receive the wipe command
      // After device is wiped, it will stop checking in.
      // User can manually remove it from list later.
    } else {
      // Remove from list only - delete immediately
      await ctx.db.delete(device._id)
    }
  },
})

/**
 * Update device policy (NEW)
 */
export const updateDevicePolicy = mutation({
  args: {
    deviceId: v.string(),
    policyId: v.id("policies"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first()

    if (!device) {
      throw new Error("Device not found or unauthorized")
    }

    // Verify policy exists and belongs to user
    const policy = await ctx.db.get(args.policyId)
    if (!policy || policy.userId !== identity.subject) {
      throw new Error("Policy not found or unauthorized")
    }

    await ctx.db.patch(device._id, {
      policyId: args.policyId,
    })
  },
})
