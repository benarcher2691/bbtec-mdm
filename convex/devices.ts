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

/**
 * ════════════════════════════════════════════════════════════════
 * Physical Device Resolution (Two-Table Architecture)
 * ════════════════════════════════════════════════════════════════
 *
 * Physical devices (devices table) can have multiple enrollments (deviceClients table)
 * This section implements device matching and creation logic
 */

/**
 * Validates if a serial number is real (not a placeholder or Android ID collision)
 */
function isValidSerial(serial: string | null | undefined, ssaId: string | null | undefined): boolean {
  if (!serial) return false;

  const lower = serial.toLowerCase();

  // Reject known placeholders
  if (lower === "unknown" || lower === "0" || serial === "") return false;

  // Reject all-zeros
  if (/^0+$/.test(serial)) return false;

  // Reject if it looks like an Android ID (16 hex characters)
  if (/^[0-9a-f]{16}$/i.test(serial)) return false;

  // Reject if it equals the SSAID (collision)
  if (ssaId && serial === ssaId) return false;

  return true;
}

/**
 * Resolve or create a physical device
 *
 * Matching strategy (in order):
 * 1. Primary: Match by SSAID (app-scoped Android ID)
 * 2. Secondary: Match by serial number (if valid) + brand + model
 * 3. Create new device if no match
 *
 * Returns the device ID (to be stored in enrollments as physicalDeviceId)
 */
export const resolveDevice = mutation({
  args: {
    ssaId: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    brand: v.string(),
    model: v.string(),
    manufacturer: v.string(),
    buildFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ssaId, serialNumber, brand, model, manufacturer, buildFingerprint } = args;

    // 1) Primary match: SSAID
    if (ssaId && ssaId !== "0" && ssaId !== "unknown") {
      const deviceBySsaid = await ctx.db
        .query("devices")
        .withIndex("by_ssaid", (q) => q.eq("ssaId", ssaId))
        .first();

      if (deviceBySsaid) {
        console.log(`✅ Matched device by SSAID: ${deviceBySsaid._id}`);

        // Update timestamp
        await ctx.db.patch(deviceBySsaid._id, {
          updatedAt: Date.now(),
        });

        return deviceBySsaid._id;
      }
    }

    // 2) Secondary match: Serial number (if valid)
    if (isValidSerial(serialNumber, ssaId)) {
      const deviceBySerial = await ctx.db
        .query("devices")
        .withIndex("by_serial", (q) => q.eq("serialNumber", serialNumber!))
        .first();

      // Validate brand and model match (prevent false positives)
      if (deviceBySerial && deviceBySerial.brand === brand && deviceBySerial.model === model) {
        console.log(`✅ Matched device by serial number: ${deviceBySerial._id}`);

        // Update timestamp
        await ctx.db.patch(deviceBySerial._id, {
          updatedAt: Date.now(),
        });

        return deviceBySerial._id;
      }
    }

    // 3) No match found - create new device
    const newDeviceId = await ctx.db.insert("devices", {
      ssaId: ssaId || null,
      serialNumber: isValidSerial(serialNumber, ssaId) ? serialNumber! : null,
      brand,
      model,
      manufacturer,
      buildFingerprint: buildFingerprint || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`🆕 Created new device: ${newDeviceId}`);
    return newDeviceId;
  },
});

/**
 * Get all enrollments for a physical device
 */
export const getEnrollmentsByDevice = query({
  args: {
    deviceId: v.id("devices"),
  },
  handler: async (ctx, args) => {
    const enrollments = await ctx.db
      .query("deviceClients")
      .withIndex("by_physical_device", (q) => q.eq("physicalDeviceId", args.deviceId))
      .collect();

    return enrollments;
  },
});

/**
 * Get device by ID
 */
export const getDevice = query({
  args: {
    deviceId: v.id("devices"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.deviceId);
  },
});

/**
 * Get all physical devices
 */
export const getAllDevices = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("devices").collect();
  },
});

/**
 * Get devices with enrollment count
 */
export const getDevicesWithEnrollmentCount = query({
  args: {},
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").collect();

    const devicesWithCount = await Promise.all(
      devices.map(async (device) => {
        const enrollments = await ctx.db
          .query("deviceClients")
          .withIndex("by_physical_device", (q) => q.eq("physicalDeviceId", device._id))
          .collect();

        return {
          ...device,
          enrollmentCount: enrollments.length,
          enrollments,
        };
      })
    );

    return devicesWithCount;
  },
});
