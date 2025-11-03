import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Create a device command (lock, wipe, reboot, update_policy)
 */
export const createCommand = mutation({
  args: {
    deviceId: v.string(),
    commandType: v.string(), // "lock", "wipe", "reboot", "update_policy"
    parameters: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Verify device belongs to user
    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first()

    if (!device) {
      throw new Error("Device not found or unauthorized")
    }

    return await ctx.db.insert("deviceCommands", {
      deviceId: args.deviceId,
      commandType: args.commandType,
      parameters: args.parameters,
      status: "pending",
      createdAt: Date.now(),
    })
  },
})

/**
 * Get pending commands for a device (called by DPC)
 * Public - authenticated via device API token
 */
export const getPendingCommands = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deviceCommands")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect()
  },
})

/**
 * Update command status (called by DPC after execution)
 */
export const updateCommandStatus = mutation({
  args: {
    commandId: v.id("deviceCommands"),
    status: v.string(), // "executing", "completed", "failed"
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const updates: any = {
      status: args.status,
      error: args.error,
    }

    if (args.status === "executing") {
      updates.executedAt = now
    }

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = now
    }

    await ctx.db.patch(args.commandId, updates)
  },
})

/**
 * Get command history for a device
 */
export const getCommandHistory = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    // Verify device ownership
    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first()

    if (!device) return []

    return await ctx.db
      .query("deviceCommands")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(50)
  },
})

/**
 * Cancel a pending command
 */
export const cancelCommand = mutation({
  args: { commandId: v.id("deviceCommands") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const command = await ctx.db.get(args.commandId)
    if (!command) throw new Error("Command not found")

    // Verify device ownership
    const device = await ctx.db
      .query("deviceClients")
      .withIndex("by_device", (q) => q.eq("deviceId", command.deviceId))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first()

    if (!device) throw new Error("Unauthorized")

    // Can only cancel pending commands
    if (command.status !== "pending") {
      throw new Error("Can only cancel pending commands")
    }

    await ctx.db.patch(args.commandId, {
      status: "failed",
      error: "Cancelled by user",
      completedAt: Date.now(),
    })
  },
})

/**
 * Delete old completed commands (cleanup)
 */
export const cleanupOldCommands = mutation({
  args: { olderThanDays: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const cutoffTime = Date.now() - (args.olderThanDays * 24 * 60 * 60 * 1000)

    const oldCommands = await ctx.db
      .query("deviceCommands")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) => q.lt(q.field("completedAt"), cutoffTime))
      .collect()

    for (const command of oldCommands) {
      await ctx.db.delete(command._id)
    }

    return { deleted: oldCommands.length }
  },
})
