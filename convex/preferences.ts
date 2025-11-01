import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Get user preferences
 */
export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()

    return preferences
  },
})

/**
 * Update user preferences
 */
export const updatePreferences = mutation({
  args: {
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    defaultPolicyId: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    // Check if preferences already exist
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()

    if (existing) {
      // Update existing preferences
      await ctx.db.patch(existing._id, {
        theme: args.theme ?? existing.theme,
        defaultPolicyId: args.defaultPolicyId ?? existing.defaultPolicyId,
        notificationsEnabled: args.notificationsEnabled ?? existing.notificationsEnabled,
      })
      return existing._id
    } else {
      // Create new preferences with defaults
      const id = await ctx.db.insert("userPreferences", {
        userId: userId,
        theme: args.theme,
        defaultPolicyId: args.defaultPolicyId,
        notificationsEnabled: args.notificationsEnabled ?? true,
      })
      return id
    }
  },
})
