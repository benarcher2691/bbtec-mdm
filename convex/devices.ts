import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Get device notes and customizations for a specific device
 */
export const getDeviceNotes = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const deviceNotes = await ctx.db
      .query("deviceNotes")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first()

    return deviceNotes
  },
})

/**
 * Get all device notes for the current user
 */
export const getAllDeviceNotes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const deviceNotes = await ctx.db
      .query("deviceNotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()

    return deviceNotes
  },
})

/**
 * Update device notes and customizations
 */
export const updateDeviceNotes = mutation({
  args: {
    deviceId: v.string(),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    customName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    // Check if device notes already exist
    const existing = await ctx.db
      .query("deviceNotes")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first()

    if (existing) {
      // Update existing notes
      await ctx.db.patch(existing._id, {
        notes: args.notes ?? existing.notes,
        tags: args.tags ?? existing.tags,
        customName: args.customName ?? existing.customName,
      })
      return existing._id
    } else {
      // Create new device notes
      const id = await ctx.db.insert("deviceNotes", {
        deviceId: args.deviceId,
        userId: userId,
        notes: args.notes,
        tags: args.tags || [],
        customName: args.customName,
      })
      return id
    }
  },
})

/**
 * Delete device notes
 */
export const deleteDeviceNotes = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const existing = await ctx.db
      .query("deviceNotes")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
