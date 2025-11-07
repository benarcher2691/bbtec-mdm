import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Create a new company user
 */
export const createCompanyUser = mutation({
  args: {
    companyName: v.string(),
    contactPersonName: v.string(),
    contactPersonEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Check if email already exists
    const existing = await ctx.db
      .query("companyUsers")
      .withIndex("by_email", (q) => q.eq("contactPersonEmail", args.contactPersonEmail))
      .first()

    if (existing) {
      throw new Error("A user with this email already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("companyUsers", {
      companyName: args.companyName,
      contactPersonName: args.contactPersonName,
      contactPersonEmail: args.contactPersonEmail,
      ownerId: identity.subject,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update a company user
 */
export const updateCompanyUser = mutation({
  args: {
    id: v.id("companyUsers"),
    companyName: v.string(),
    contactPersonName: v.string(),
    contactPersonEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const user = await ctx.db.get(args.id)
    if (!user) throw new Error("User not found")
    if (user.ownerId !== identity.subject) throw new Error("Unauthorized")

    // Check if email is taken by another user
    const existing = await ctx.db
      .query("companyUsers")
      .withIndex("by_email", (q) => q.eq("contactPersonEmail", args.contactPersonEmail))
      .first()

    if (existing && existing._id !== args.id) {
      throw new Error("A user with this email already exists")
    }

    await ctx.db.patch(args.id, {
      companyName: args.companyName,
      contactPersonName: args.contactPersonName,
      contactPersonEmail: args.contactPersonEmail,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Delete a company user
 */
export const deleteCompanyUser = mutation({
  args: { id: v.id("companyUsers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const user = await ctx.db.get(args.id)
    if (!user) throw new Error("User not found")
    if (user.ownerId !== identity.subject) throw new Error("Unauthorized")

    // Check if any devices are assigned to this user
    const devices = await ctx.db
      .query("deviceClients")
      .withIndex("by_company_user", (q) => q.eq("companyUserId", args.id))
      .first()

    if (devices) {
      throw new Error("Cannot delete user with assigned devices. Please reassign devices first.")
    }

    await ctx.db.delete(args.id)
  },
})

/**
 * List all company users for current owner
 */
export const listCompanyUsers = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    return await ctx.db
      .query("companyUsers")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect()
  },
})

/**
 * Get a single company user
 */
export const getCompanyUser = query({
  args: { id: v.id("companyUsers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db.get(args.id)
    if (!user || user.ownerId !== identity.subject) return null

    return user
  },
})
