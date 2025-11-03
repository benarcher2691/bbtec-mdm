import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Create a new device policy
 */
export const createPolicy = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),

    // Password requirements
    passwordRequired: v.boolean(),
    passwordMinLength: v.optional(v.number()),
    passwordQuality: v.optional(v.string()),

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
      security: v.string(),
    }))),

    // Kiosk mode
    kioskEnabled: v.boolean(),
    kioskPackageNames: v.optional(v.array(v.string())),

    // System behavior
    statusBarDisabled: v.boolean(),
    systemAppsDisabled: v.optional(v.array(v.string())),

    // Whether this is the default policy
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const now = Date.now()

    // If setting as default, unset any existing default
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("policies")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .filter((q) => q.eq(q.field("userId"), identity.subject))
        .collect()

      for (const policy of existingDefaults) {
        await ctx.db.patch(policy._id, { isDefault: false })
      }
    }

    return await ctx.db.insert("policies", {
      ...args,
      userId: identity.subject,
      createdAt: now,
      updatedAt: now,
      isDefault: args.isDefault ?? false,
    })
  },
})

/**
 * Get policy by ID
 */
export const getPolicy = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db.get(args.policyId)
  },
})

/**
 * List all policies for current user
 */
export const listPolicies = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    return await ctx.db
      .query("policies")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect()
  },
})

/**
 * Get default policy for current user
 */
export const getDefaultPolicy = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db
      .query("policies")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first()
  },
})

/**
 * Update an existing policy
 */
export const updatePolicy = mutation({
  args: {
    policyId: v.id("policies"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),

    // Password requirements
    passwordRequired: v.optional(v.boolean()),
    passwordMinLength: v.optional(v.number()),
    passwordQuality: v.optional(v.string()),

    // Device restrictions
    cameraDisabled: v.optional(v.boolean()),
    screenCaptureDisabled: v.optional(v.boolean()),
    bluetoothDisabled: v.optional(v.boolean()),
    usbFileTransferDisabled: v.optional(v.boolean()),
    factoryResetDisabled: v.optional(v.boolean()),

    // Network settings
    wifiConfigs: v.optional(v.array(v.object({
      ssid: v.string(),
      password: v.optional(v.string()),
      security: v.string(),
    }))),

    // Kiosk mode
    kioskEnabled: v.optional(v.boolean()),
    kioskPackageNames: v.optional(v.array(v.string())),

    // System behavior
    statusBarDisabled: v.optional(v.boolean()),
    systemAppsDisabled: v.optional(v.array(v.string())),

    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const { policyId, ...updates } = args

    // Verify ownership
    const policy = await ctx.db.get(policyId)
    if (!policy || policy.userId !== identity.subject) {
      throw new Error("Unauthorized")
    }

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      const existingDefaults = await ctx.db
        .query("policies")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .filter((q) => q.eq(q.field("userId"), identity.subject))
        .collect()

      for (const defaultPolicy of existingDefaults) {
        if (defaultPolicy._id !== policyId) {
          await ctx.db.patch(defaultPolicy._id, { isDefault: false })
        }
      }
    }

    await ctx.db.patch(policyId, {
      ...updates,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Delete a policy
 */
export const deletePolicy = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Verify ownership
    const policy = await ctx.db.get(args.policyId)
    if (!policy || policy.userId !== identity.subject) {
      throw new Error("Unauthorized")
    }

    // Check if any devices are using this policy
    const devicesUsingPolicy = await ctx.db
      .query("deviceClients")
      .filter((q) => q.eq(q.field("policyId"), args.policyId))
      .collect()

    if (devicesUsingPolicy.length > 0) {
      throw new Error(`Cannot delete policy: ${devicesUsingPolicy.length} device(s) are using it`)
    }

    await ctx.db.delete(args.policyId)
  },
})
