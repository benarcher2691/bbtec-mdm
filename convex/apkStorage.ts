import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Generate upload URL for DPC APK
 * This is called by the web UI before uploading the file
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Save APK metadata after successful upload
 */
export const saveApkMetadata = mutation({
  args: {
    version: v.string(),
    versionCode: v.number(),
    storageId: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    signatureChecksum: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    // Mark all existing APKs as not current
    const existingApks = await ctx.db
      .query("apkMetadata")
      .withIndex("by_current", (q) => q.eq("isCurrent", true))
      .collect()

    for (const apk of existingApks) {
      await ctx.db.patch(apk._id, { isCurrent: false })
    }

    // Insert new APK as current version
    return await ctx.db.insert("apkMetadata", {
      version: args.version,
      versionCode: args.versionCode,
      storageId: args.storageId as any, // Convex storage ID
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
 * Get APK download URL
 * Called by DPC during provisioning
 */
export const getApkDownloadUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId as any)
  },
})

/**
 * Increment download count (called when device downloads APK)
 */
export const incrementDownloadCount = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const apk = await ctx.db
      .query("apkMetadata")
      .filter((q) => q.eq(q.field("storageId"), args.storageId as any))
      .first()

    if (apk) {
      await ctx.db.patch(apk._id, {
        downloadCount: apk.downloadCount + 1,
      })
    }
  },
})

/**
 * Delete an APK version
 */
export const deleteApk = mutation({
  args: { apkId: v.id("apkMetadata") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")

    const apk = await ctx.db.get(args.apkId)
    if (!apk) throw new Error("APK not found")

    // Delete from storage
    await ctx.storage.delete(apk.storageId)

    // Delete metadata
    await ctx.db.delete(args.apkId)
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
