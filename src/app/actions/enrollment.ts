"use server"

import { auth } from '@clerk/nextjs/server'
import QRCode from 'qrcode'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Create custom enrollment QR code (NEW: Custom DPC)
 * Replaces Android Management API token generation
 */
export async function createEnrollmentQRCode(
  policyId: Id<"policies">,
  duration: number = 3600
) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    // Get current APK metadata
    const currentApk = await convex.query(api.apkStorage.getCurrentApk)

    if (!currentApk) {
      return {
        success: false,
        error: 'No DPC APK uploaded. Please upload the client APK first.',
      }
    }

    // Get APK download URL from Convex storage
    const apkUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId: currentApk.storageId,
    })

    if (!apkUrl) {
      return {
        success: false,
        error: 'Failed to generate APK download URL',
      }
    }

    // Create enrollment token
    const tokenId = await convex.mutation(api.enrollmentTokens.createEnrollmentToken, {
      policyId,
      expiresInSeconds: duration,
    })

    const token = await convex.query(api.enrollmentTokens.getToken, { tokenId })

    if (!token) {
      return {
        success: false,
        error: 'Failed to create enrollment token',
      }
    }

    // Build Android provisioning JSON (custom DPC format)
    const provisioningData = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/.MdmDeviceAdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": apkUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": currentApk.signatureChecksum,
      "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        "server_url": process.env.NEXT_PUBLIC_APP_URL || "https://bbtec-mdm.vercel.app",
        "enrollment_token": token.token,
      }
    }

    // Generate QR code from JSON
    const qrContent = JSON.stringify(provisioningData)
    const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H',  // High error correction for complex data
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })

    return {
      success: true,
      token: token.token,
      qrCode: qrCodeDataUrl,
      expirationTimestamp: new Date(token.expiresAt).toISOString(),
      apkVersion: currentApk.version,
    }
  } catch (error) {
    console.error('Error creating enrollment QR code:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create enrollment QR code',
    }
  }
}

/**
 * List enrolled devices (from Convex, not Google API)
 */
export async function listDevices() {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    const devices = await convex.query(api.deviceClients.listDevices)

    return {
      success: true,
      devices: devices || [],
    }
  } catch (error) {
    console.error('Error listing devices:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list devices',
      devices: [],
    }
  }
}

/**
 * Get device details
 */
export async function getDevice(deviceId: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    const device = await convex.query(api.deviceClients.getDevice, { deviceId })

    return {
      success: true,
      device,
    }
  } catch (error) {
    console.error('Error getting device:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get device',
    }
  }
}

/**
 * Issue device command (lock, wipe, reboot)
 */
export async function issueDeviceCommand(
  deviceId: string,
  commandType: 'lock' | 'wipe' | 'reboot' | 'update_policy',
  parameters?: unknown
) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    await convex.mutation(api.deviceCommands.createCommand, {
      deviceId,
      commandType,
      parameters,
    })

    return {
      success: true,
      message: `Command ${commandType} queued successfully`,
    }
  } catch (error) {
    console.error('Error issuing device command:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to issue device command',
    }
  }
}

/**
 * Delete device
 */
export async function deleteDevice(deviceId: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    await convex.mutation(api.deviceClients.deleteDevice, { deviceId })

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error deleting device:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete device',
    }
  }
}

/**
 * Install app on device (queues installation command)
 */
export async function installAppOnDevice(
  deviceId: string,
  packageName: string,
  downloadUrl: string
) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    // Extract app name from package name
    const appName = packageName.split('.').pop() || packageName

    // Queue installation command for the client app to execute
    const commandId = await convex.mutation(api.installCommands.create, {
      deviceId,
      apkUrl: downloadUrl,
      packageName,
      appName,
    })

    return {
      success: true,
      message: 'Installation queued. The app will install silently when the device checks in (within 15 minutes).',
      commandId,
    }
  } catch (error) {
    console.error('Error queueing installation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue installation',
    }
  }
}
