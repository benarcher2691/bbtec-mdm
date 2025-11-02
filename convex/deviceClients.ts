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
      userId: "system", // TODO: Associate with actual user via QR enrollment
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
