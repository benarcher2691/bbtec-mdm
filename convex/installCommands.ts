import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Create a new installation command
 */
export const create = mutation({
  args: {
    deviceId: v.string(),
    apkUrl: v.string(),
    packageName: v.string(),
    appName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check auth
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    return await ctx.db.insert("installCommands", {
      deviceId: args.deviceId,
      apkUrl: args.apkUrl,
      packageName: args.packageName,
      appName: args.appName,
      status: "pending",
      createdAt: Date.now(),
    })
  },
})

/**
 * Get commands for a specific device (for UI)
 */
export const getByDevice = query({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check auth
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    return await ctx.db
      .query("installCommands")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .collect()
  },
})

/**
 * Get all pending commands (for monitoring)
 */
export const getAllPending = query({
  handler: async (ctx) => {
    // Check auth
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    return await ctx.db
      .query("installCommands")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect()
  },
})
