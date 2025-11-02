import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Register a new device client
 * Device metadata comes from Android Management API - we only track connection status
 */
export const registerDevice = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if device already registered
    const existing = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first()

    if (existing) {
      // Update heartbeat - return existing token
      await ctx.db.patch(existing._id, {
        lastHeartbeat: Date.now(),
        status: "online",
      })
      return {
        deviceClientId: existing._id,
        apiToken: existing.apiToken,
      }
    }

    // Generate secure API token for new device
    const apiToken = crypto.randomUUID()

    // New registration - establish polling connection with auth token
    const deviceClientId = await ctx.db.insert("deviceClients", {
      deviceId: args.deviceId,
      apiToken,
      lastHeartbeat: Date.now(),
      status: "online",
      pingInterval: 15, // Check in every 15 minutes
      registeredAt: Date.now(),
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
 * Update ping interval for a device
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
