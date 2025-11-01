import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Database schema for bbtec-mdm
 *
 * Note: Device data comes from Android Management API (not stored here)
 * This schema is for user-specific customizations and app data
 */

export default defineSchema({
  // Custom device tags and notes
  deviceNotes: defineTable({
    deviceId: v.string(), // Android device ID
    userId: v.string(),   // Clerk user ID
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
    customName: v.optional(v.string()),
  }).index("by_device", ["deviceId"])
    .index("by_user", ["userId"]),

  // User preferences
  userPreferences: defineTable({
    userId: v.string(), // Clerk user ID
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    defaultPolicyId: v.optional(v.string()),
    notificationsEnabled: v.boolean(),
  }).index("by_user", ["userId"]),

  // Audit log for actions
  auditLog: defineTable({
    userId: v.string(),
    action: v.string(), // "create_policy", "enroll_device", "delete_device", etc.
    resourceType: v.string(), // "device", "policy", "token"
    resourceId: v.string(),
    metadata: v.optional(v.object({
      deviceName: v.optional(v.string()),
      policyName: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
    })),
    timestamp: v.number(),
  }).index("by_user", ["userId"])
    .index("by_resource", ["resourceType", "resourceId"]),
});
