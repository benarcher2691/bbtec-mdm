import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Save APK metadata after successful upload to Vercel Blob
 */
export const saveApkMetadata = mutation({
  args: {
    version: v.string(),
    versionCode: v.number(),
    blobUrl: v.string(),
    variant: v.union(v.literal("local"), v.literal("staging"), v.literal("production")),
    fileName: v.string(),
    fileSize: v.number(),
    signatureChecksum: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Mark all existing APKs of this variant as not current
    const existingApks = await ctx.db
      .query("apkMetadata")
      .withIndex("by_variant_current", (q) =>
        q.eq("variant", args.variant).eq("isCurrent", true)
      )
      .collect()

    for (const apk of existingApks) {
      await ctx.db.patch(apk._id, { isCurrent: false })
    }

    // Insert new APK as current version for this variant
    return await ctx.db.insert("apkMetadata", {
      version: args.version,
      versionCode: args.versionCode,
      blobUrl: args.blobUrl,
      variant: args.variant,
      fileName: args.fileName,
      fileSize: args.fileSize,
      signatureChecksum: args.signatureChecksum,
      uploadedBy: identity.subject,
      uploadedAt: Date.now(),
      isCurrent: true,
      downloadCount: 0,
    })
  },
})

/**
 * Get current APK for QR code generation
 * @deprecated Use getCurrentApkByVariant instead
 */
export const getCurrentApk = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("apkMetadata")
      .withIndex("by_current", (q) => q.eq("isCurrent", true))
      .first()
  },
})

/**
 * Get current APK by variant (for environment-specific QR codes)
 */
export const getCurrentApkByVariant = query({
  args: {
    variant: v.union(v.literal("local"), v.literal("staging"), v.literal("production")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apkMetadata")
      .withIndex("by_variant_current", (q) =>
        q.eq("variant", args.variant).eq("isCurrent", true)
      )
      .first()
  },
})

/**
 * Get all APK versions (for history)
 */
export const listApks = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    return await ctx.db
      .query("apkMetadata")
      .order("desc")
      .take(20) // Last 20 versions
  },
})

/**
 * Get APK blob URL by APK ID
 */
export const getApkBlobUrl = query({
  args: { apkId: v.id("apkMetadata") },
  handler: async (ctx, args) => {
    const apk = await ctx.db.get(args.apkId)
    return apk?.blobUrl
  },
})

/**
 * Increment download count (called when device downloads APK)
 */
export const incrementDownloadCount = mutation({
  args: { apkId: v.id("apkMetadata") },
  handler: async (ctx, args) => {
    const apk = await ctx.db.get(args.apkId)

    if (apk) {
      await ctx.db.patch(apk._id, {
        downloadCount: apk.downloadCount + 1,
      })
    }
  },
})

/**
 * Delete an APK version
 * Note: Blob deletion happens via /api/blobs/delete route
 * This only removes the metadata record
 */
export const deleteApk = mutation({
  args: {
    apkId: v.id("apkMetadata"),
    blobUrl: v.string(), // Needed for blob deletion
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const apk = await ctx.db.get(args.apkId)
    if (!apk) throw new Error("APK not found")

    // Delete metadata
    await ctx.db.delete(args.apkId)

    // Return blobUrl so caller can delete from Vercel Blob
    return { blobUrl: apk.blobUrl }
  },
})

/**
 * Set specific APK as current version
 */
export const setCurrentApk = mutation({
  args: { apkId: v.id("apkMetadata") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Unset all current flags
    const existingCurrent = await ctx.db
      .query("apkMetadata")
      .withIndex("by_current", (q) => q.eq("isCurrent", true))
      .collect()

    for (const apk of existingCurrent) {
      await ctx.db.patch(apk._id, { isCurrent: false })
    }

    // Set new current
    await ctx.db.patch(args.apkId, { isCurrent: true })
  },
})
