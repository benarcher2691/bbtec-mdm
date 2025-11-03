import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Create enrollment token
 */
export const createEnrollmentToken = mutation({
  args: {
    policyId: v.id("policies"),
    expiresInSeconds: v.number(), // Default: 3600 (1 hour)
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Verify policy exists and belongs to user
    const policy = await ctx.db.get(args.policyId)
    if (!policy || policy.userId !== identity.subject) {
      throw new Error("Policy not found or unauthorized")
    }

    // Get current APK version
    const currentApk = await ctx.db
      .query("apkMetadata")
      .withIndex("by_current", (q) => q.eq("isCurrent", true))
      .first()

    if (!currentApk) {
      throw new Error("No DPC APK uploaded. Please upload an APK first.")
    }

    // Generate random token (UUID style)
    const token = crypto.randomUUID()

    const now = Date.now()
    const expiresAt = now + (args.expiresInSeconds * 1000)

    return await ctx.db.insert("enrollmentTokens", {
      token,
      userId: identity.subject,
      policyId: args.policyId,
      createdAt: now,
      expiresAt,
      used: false,
      serverUrl: process.env.NEXT_PUBLIC_APP_URL || "https://bbtec-mdm.vercel.app",
      apkVersion: currentApk.version,
    })
  },
})

/**
 * Get enrollment token by ID
 */
export const getToken = query({
  args: { tokenId: v.id("enrollmentTokens") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tokenId)
  },
})

/**
 * Validate and get enrollment token details (public - no auth required)
 * Called by DPC during provisioning
 */
export const validateToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("enrollmentTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!tokenRecord) {
      return { valid: false, reason: "Token not found" }
    }

    if (tokenRecord.used) {
      return { valid: false, reason: "Token already used" }
    }

    if (Date.now() > tokenRecord.expiresAt) {
      return { valid: false, reason: "Token expired" }
    }

    return {
      valid: true,
      policyId: tokenRecord.policyId,
      serverUrl: tokenRecord.serverUrl,
      userId: tokenRecord.userId,
    }
  },
})

/**
 * Mark token as used during device enrollment (public - no auth required)
 */
export const markTokenUsed = mutation({
  args: {
    token: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("enrollmentTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (tokenRecord && !tokenRecord.used) {
      await ctx.db.patch(tokenRecord._id, {
        used: true,
        usedAt: Date.now(),
        usedByDeviceId: args.deviceId,
      })
    }
  },
})

/**
 * List enrollment tokens for current user
 */
export const listTokens = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    return await ctx.db
      .query("enrollmentTokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(50) // Last 50 tokens
  },
})

/**
 * Delete an enrollment token
 */
export const deleteToken = mutation({
  args: { tokenId: v.id("enrollmentTokens") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const token = await ctx.db.get(args.tokenId)
    if (!token || token.userId !== identity.subject) {
      throw new Error("Unauthorized")
    }

    await ctx.db.delete(args.tokenId)
  },
})
