import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Log an action to the audit log
 */
export const logAction = mutation({
  args: {
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    metadata: v.optional(
      v.object({
        deviceName: v.optional(v.string()),
        policyName: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const id = await ctx.db.insert("auditLog", {
      userId: userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      metadata: args.metadata,
      timestamp: Date.now(),
    })

    return id
  },
})

/**
 * Get audit log for current user
 */
export const getAuditLog = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject
    const limit = args.limit || 50

    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit)

    return logs
  },
})

/**
 * Get audit log for a specific resource
 */
export const getResourceAuditLog = query({
  args: {
    resourceType: v.string(),
    resourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", args.resourceType).eq("resourceId", args.resourceId)
      )
      .order("desc")
      .collect()

    return logs
  },
})
