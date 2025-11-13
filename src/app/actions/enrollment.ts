"use server"

import { auth } from '@clerk/nextjs/server'
import QRCode from 'qrcode'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { detectServerUrl } from '@/lib/network-detection'

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
 *
 * @param policyId - Policy to apply to the device
 * @param duration - Token validity duration in seconds
 * @param testMode - If true, omits PROVISIONING_ADMIN_EXTRAS_BUNDLE (for Device Owner testing on Android 10)
 * @param dpcType - 'bbtec' for BBTec MDM, 'testdpc' for Google Test DPC comparison
 */
export async function createEnrollmentQRCode(
  policyId: Id<"policies">,
  duration: number = 3600,
  testMode: boolean = false,
  dpcType: 'bbtec' | 'testdpc' = 'bbtec',
  companyUserId?: Id<"companyUsers">
) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    const convex = await getAuthenticatedConvexClient()

    // Dynamic server URL detection (environment-aware)
    const networkDetection = detectServerUrl('[QR-GEN]')
    const serverUrl = networkDetection.serverUrl

    console.log('[QR-GEN] Network detection result:', {
      serverUrl: networkDetection.serverUrl,
      environment: networkDetection.environment,
      isLocal: networkDetection.isLocal,
      detectedIp: networkDetection.detectedIp,
      detectionMethod: networkDetection.detectionMethod
    })

    // DPC configuration based on type
    let dpcConfig: {
      componentName: string
      packageName: string
      apkUrl: string
      signatureChecksum: string
      version?: string
    }

    // Create enrollment token FIRST (needed for APK URL)
    const tokenId = await convex.mutation(api.enrollmentTokens.createEnrollmentToken, {
      policyId,
      expiresInSeconds: duration,
      companyUserId,
    })

    const token = await convex.query(api.enrollmentTokens.getToken, { tokenId })

    if (!token) {
      return {
        success: false,
        error: 'Failed to create enrollment token',
      }
    }

    if (dpcType === 'testdpc') {
      // Google Test DPC for comparison testing
      // Hardcoded values (upload code has signature extraction bug)
      const testdpcStorageId = 'kg23cdbbs108fmjm6qrxzm2d517twwhf'
      dpcConfig = {
        componentName: 'com.afwsamples.testdpc/com.afwsamples.testdpc.DeviceAdminReceiver',
        packageName: 'com.afwsamples.testdpc',
        apkUrl: `${serverUrl}/api/apps/${testdpcStorageId}?token=${token.token}`,
        signatureChecksum: 'gJD2YwtOiWJHkSMkkIfLRlj-quNqG1fb6v100QmzM9w', // Correct TestDPC signature
        version: '9.0.12 (TestDPC)',
      }
      console.log('[QR GEN] Using Test DPC for comparison')
    } else {
      // BBTec MDM Client
      const currentApk = await convex.query(api.apkStorage.getCurrentApk)

      if (!currentApk) {
        return {
          success: false,
          error: 'No DPC APK uploaded. Please upload the client APK first.',
        }
      }

      // Environment-aware package configuration
      // This enforces using the correct APK variant for each environment
      const isPreview = process.env.VERCEL_ENV === 'preview'
      const isLocal = process.env.NEXT_PUBLIC_CONVEX_URL?.includes('127.0.0.1')

      let packageName: string
      let environmentName: string

      if (isPreview) {
        // Preview/staging deployments use staging APK
        packageName = 'com.bbtec.mdm.client.staging'
        environmentName = 'PREVIEW/STAGING'
      } else if (isLocal) {
        // Local development uses production package (for provisioning testing)
        packageName = 'com.bbtec.mdm.client'
        environmentName = 'LOCAL'
      } else {
        // Production uses production package
        packageName = 'com.bbtec.mdm.client'
        environmentName = 'PRODUCTION'
      }

      // Component name: package changes, but class path stays com.bbtec.mdm.client.MdmDeviceAdminReceiver
      // Example: com.bbtec.mdm.client.staging/com.bbtec.mdm.client.MdmDeviceAdminReceiver
      const componentName = `${packageName}/com.bbtec.mdm.client.MdmDeviceAdminReceiver`

      dpcConfig = {
        componentName,
        packageName,
        apkUrl: `${serverUrl}/api/apps/${currentApk.storageId}?token=${token.token}`,
        signatureChecksum: currentApk.signatureChecksum,
        version: currentApk.version,
      }

      console.log('[QR GEN] Environment:', environmentName)
      console.log('[QR GEN] VERCEL_ENV:', process.env.VERCEL_ENV)
      console.log('[QR GEN] Package name:', packageName)
      console.log('[QR GEN] Component name:', componentName)
      console.log('[QR GEN] APK URL (redirect):', dpcConfig.apkUrl)
      console.log('[QR GEN] Storage ID:', currentApk.storageId)
    }

    // Build Android provisioning JSON (custom DPC format)
    console.log('[QR GEN] Server URL:', serverUrl)
    console.log('[QR GEN] Enrollment token:', token.token.substring(0, 8) + '...')
    console.log('[QR GEN] Test mode:', testMode)

    const provisioningData: Record<string, unknown> = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": dpcConfig.componentName,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": dpcConfig.packageName,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": dpcConfig.apkUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": dpcConfig.signatureChecksum,
      "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
    }

    // Only include admin extras bundle if NOT in test mode
    // TEST: On Android 10, admin extras bundle might force Profile Owner mode
    if (!testMode) {
      provisioningData["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"] = {
        "server_url": serverUrl,
        "enrollment_token": token.token,
      }
    } else {
      console.log('[QR GEN] ⚠️ TEST MODE: Omitting PROVISIONING_ADMIN_EXTRAS_BUNDLE')
      console.log('[QR GEN] ⚠️ Device will NOT register automatically')
      console.log('[QR GEN] ⚠️ Purpose: Test Device Owner mode on Android 10')
    }

    // Generate QR code from JSON
    const qrContent = JSON.stringify(provisioningData)

    // Debug logging
    console.log('[QR GEN] provisioningData object:', provisioningData)
    console.log('[QR GEN] QR Content (first 500 chars):', qrContent.substring(0, 500))
    console.log('QR Code provisioning data:', {
      apkUrlLength: dpcConfig.apkUrl?.length,
      totalJsonLength: qrContent.length,
      signatureChecksum: dpcConfig.signatureChecksum,
    })

    if (qrContent.length > 4000) {
      console.warn(`QR code data is ${qrContent.length} bytes - may be too large for Android scanner (recommended < 4000 bytes)`)
    }
    const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
      width: 512,
      margin: 2,  // Reduced margin for denser content
      errorCorrectionLevel: 'L',  // Low error correction for longer URLs (preview deployments)
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })

    return {
      success: true,
      tokenId,
      token: token.token,
      qrCode: qrCodeDataUrl,
      expirationTimestamp: new Date(token.expiresAt).toISOString(),
      apkVersion: dpcConfig.version,
      debug: {
        apkUrl: dpcConfig.apkUrl,
        serverUrl,
        storageId: dpcConfig.apkUrl.split('/').pop() || '',
        convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
        dpcType,
        networkDetection: {
          environment: networkDetection.environment,
          isLocal: networkDetection.isLocal,
          detectedIp: networkDetection.detectedIp,
          detectionMethod: networkDetection.detectionMethod,
        },
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
