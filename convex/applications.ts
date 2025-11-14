import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Get all applications uploaded by the current user
 */
export const listApplications = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()

    return apps
  },
})

/**
 * Get a single application by ID
 */
export const getApplication = query({
  args: { id: v.id("applications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const app = await ctx.db.get(args.id)

    if (!app) {
      throw new Error("Application not found")
    }

    // Ensure user owns this app
    if (app.userId !== identity.subject) {
      throw new Error("Not authorized")
    }

    return app
  },
})

/**
 * Save application metadata after upload
 * Note: Applications table still uses Convex storage (can migrate to Vercel Blob later)
 */
export const saveApplication = mutation({
  args: {
    name: v.string(),
    packageName: v.string(),
    versionName: v.string(),
    versionCode: v.number(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const userId = identity.subject

    const appId = await ctx.db.insert("applications", {
      userId,
      name: args.name,
      packageName: args.packageName,
      versionName: args.versionName,
      versionCode: args.versionCode,
      fileSize: args.fileSize,
      storageId: args.storageId,
      uploadedAt: Date.now(),
      description: args.description,
    })

    return appId
  },
})

/**
 * Delete an application and its file
 */
export const deleteApplication = mutation({
  args: { id: v.id("applications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const app = await ctx.db.get(args.id)

    if (!app) {
      throw new Error("Application not found")
    }

    // Ensure user owns this app
    if (app.userId !== identity.subject) {
      throw new Error("Not authorized")
    }

    // Delete the file from storage
    await ctx.storage.delete(app.storageId)

    // Delete the database record
    await ctx.db.delete(args.id)
  },
})

/**
 * Generate upload URL for APK file
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Get download URL for an application
 */
export const getDownloadUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    return await ctx.storage.getUrl(args.storageId)
  },
})
