"use server"

import { auth } from '@clerk/nextjs/server'
import QRCode from 'qrcode'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

async function getAuthenticatedConvexClient() {
  const { getToken } = await auth()
  const token = await getToken({ template: 'convex' })

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  convex.setAuth(token || '')

  return convex
}

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
    const convex = await getAuthenticatedConvexClient()

    // Get current APK metadata
    const currentApk = await convex.query(api.apkStorage.getCurrentApk)

    if (!currentApk) {
      return {
        success: false,
        error: 'No DPC APK uploaded. Please upload the client APK first.',
      }
    }

    // Use redirect URL (permanent, doesn't expire)
    // TestDPC baseline test proved Android DOES follow redirects
    const serverUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bbtec-mdm.vercel.app"
    const apkUrl = `${serverUrl}/api/apps/${currentApk.storageId}`

    console.log('[QR GEN] APK URL (redirect):', apkUrl)
    console.log('[QR GEN] Storage ID:', currentApk.storageId)

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
    console.log('[QR GEN] Server URL:', serverUrl)
    console.log('[QR GEN] Enrollment token:', token.token.substring(0, 8) + '...')

    const provisioningData = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": apkUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": currentApk.signatureChecksum,
      "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        "server_url": serverUrl,
        "enrollment_token": token.token,
      }
    }

    // Generate QR code from JSON
    const qrContent = JSON.stringify(provisioningData)

    // Debug logging
    console.log('[QR GEN] provisioningData object:', provisioningData)
    console.log('[QR GEN] QR Content (first 500 chars):', qrContent.substring(0, 500))
    console.log('QR Code provisioning data:', {
      apkUrlLength: apkUrl?.length,
      totalJsonLength: qrContent.length,
      signatureChecksum: currentApk.signatureChecksum,
    })

    if (qrContent.length > 4000) {
      console.warn(`QR code data is ${qrContent.length} bytes - may be too large for Android scanner (recommended < 4000 bytes)`)
    }
    const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
      width: 512,
      margin: 4,
      errorCorrectionLevel: 'M',  // Medium error correction (H was too complex)
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
      debug: {
        apkUrl,
        serverUrl,
        storageId: currentApk.storageId,
        convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
      },
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
    const convex = await getAuthenticatedConvexClient()
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
    const convex = await getAuthenticatedConvexClient()
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
    const convex = await getAuthenticatedConvexClient()
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
    const convex = await getAuthenticatedConvexClient()
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
    const convex = await getAuthenticatedConvexClient()

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
