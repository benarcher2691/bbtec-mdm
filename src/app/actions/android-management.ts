"use server"

import { google } from 'googleapis'
import { auth } from '@clerk/nextjs/server'
import QRCode from 'qrcode'

/**
 * Initialize Android Management API client (server-side only)
 */
async function getAndroidManagementClient() {
  const googleAuth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/androidmanagement'],
  })

  return google.androidmanagement({
    version: 'v1',
    auth: googleAuth,
  })
}

/**
 * Server Action: Create an enrollment token
 */
export async function createEnrollmentToken(policyId: string = 'default-policy', duration: number = 3600) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  const enterpriseName = process.env.ENTERPRISE_NAME
  if (!enterpriseName) {
    throw new Error('ENTERPRISE_NAME not configured')
  }

  try {
    const androidmanagement = await getAndroidManagementClient()
    const policyName = `${enterpriseName}/policies/${policyId}`

    const response = await androidmanagement.enterprises.enrollmentTokens.create({
      parent: enterpriseName,
      requestBody: {
        policyName: policyName,
        duration: `${duration}s`,
      },
    })

    const enrollmentToken = response.data.value || ''
    const qrCodeContent = response.data.qrCode || ''

    // Generate QR code as data URL from the qrCode content
    let qrCodeDataUrl = ''
    if (qrCodeContent) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(qrCodeContent, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
      } catch (qrError) {
        console.error('Error generating QR code image:', qrError)
      }
    }

    return {
      success: true,
      token: enrollmentToken,
      qrCode: qrCodeDataUrl,
      expirationTimestamp: response.data.expirationTimestamp || '',
    }
  } catch (error) {
    console.error('Error creating enrollment token:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create enrollment token',
    }
  }
}

/**
 * Server Action: List all enrolled devices
 */
export async function listDevices() {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  const enterpriseName = process.env.ENTERPRISE_NAME
  if (!enterpriseName) {
    throw new Error('ENTERPRISE_NAME not configured')
  }

  try {
    const androidmanagement = await getAndroidManagementClient()

    const response = await androidmanagement.enterprises.devices.list({
      parent: enterpriseName,
    })

    return {
      success: true,
      devices: response.data.devices || [],
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
 * Server Action: Get device details
 */
export async function getDevice(deviceId: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  const enterpriseName = process.env.ENTERPRISE_NAME
  if (!enterpriseName) {
    throw new Error('ENTERPRISE_NAME not configured')
  }

  try {
    const androidmanagement = await getAndroidManagementClient()

    const response = await androidmanagement.enterprises.devices.get({
      name: `${enterpriseName}/devices/${deviceId}`,
    })

    return {
      success: true,
      device: response.data,
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
 * Server Action: Create or update a policy
 */
export async function createPolicy(policyId: string = 'default-policy') {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  const enterpriseName = process.env.ENTERPRISE_NAME
  if (!enterpriseName) {
    throw new Error('ENTERPRISE_NAME not configured')
  }

  const defaultPolicy = {
    // Explicitly disable password requirements
    passwordRequirements: {
      passwordQuality: 'PASSWORD_QUALITY_UNSPECIFIED',
    },
    statusReportingSettings: {
      applicationReportsEnabled: true,
      deviceSettingsEnabled: true,
      softwareInfoEnabled: true,
    },
    applications: [
      {
        packageName: 'com.android.chrome',
        installType: 'AVAILABLE',
      },
    ],
  }

  try {
    const androidmanagement = await getAndroidManagementClient()
    const policyName = `${enterpriseName}/policies/${policyId}`

    const response = await androidmanagement.enterprises.policies.patch({
      name: policyName,
      requestBody: defaultPolicy,
    })

    return {
      success: true,
      policy: response.data,
    }
  } catch (error) {
    console.error('Error creating policy:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create policy',
    }
  }
}

/**
 * Server Action: Issue a device command (lock, reboot, wipe, etc.)
 */
export async function issueDeviceCommand(deviceId: string, commandType: 'REBOOT' | 'LOCK' | 'RELINQUISH_OWNERSHIP') {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  const enterpriseName = process.env.ENTERPRISE_NAME
  if (!enterpriseName) {
    throw new Error('ENTERPRISE_NAME not configured')
  }

  try {
    const androidmanagement = await getAndroidManagementClient()
    const deviceName = `${enterpriseName}/devices/${deviceId}`

    const response = await androidmanagement.enterprises.devices.issueCommand({
      name: deviceName,
      requestBody: {
        type: commandType,
      },
    })

    return {
      success: true,
      operation: response.data,
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
 * Server Action: Delete a device from the enterprise
 * This permanently removes the device. The device will be factory reset if still enrolled.
 */
export async function deleteDevice(deviceId: string, wipeData: boolean = false) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  const enterpriseName = process.env.ENTERPRISE_NAME
  if (!enterpriseName) {
    throw new Error('ENTERPRISE_NAME not configured')
  }

  try {
    const androidmanagement = await getAndroidManagementClient()
    const deviceName = `${enterpriseName}/devices/${deviceId}`

    // If wipeData is requested, issue RELINQUISH_OWNERSHIP command first
    // This will factory reset the device
    if (wipeData) {
      await androidmanagement.enterprises.devices.issueCommand({
        name: deviceName,
        requestBody: {
          type: 'RELINQUISH_OWNERSHIP',
        },
      })

      // Wait a moment for the command to be processed
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Delete the device from the enterprise
    const response = await androidmanagement.enterprises.devices.delete({
      name: deviceName,
    })

    return {
      success: true,
      wiped: wipeData,
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
 * Server Action: Install an application on a device
 * This creates a device-specific policy that includes the app
 */
export async function installAppOnDevice(deviceId: string, packageName: string, downloadUrl: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  const enterpriseName = process.env.ENTERPRISE_NAME
  if (!enterpriseName) {
    throw new Error('ENTERPRISE_NAME not configured')
  }

  try {
    const androidmanagement = await getAndroidManagementClient()

    // Create a device-specific policy name
    const devicePolicyId = `device-${deviceId}-policy`
    const policyName = `${enterpriseName}/policies/${devicePolicyId}`

    // Get current default policy to merge settings
    const defaultPolicyName = `${enterpriseName}/policies/default-policy`
    let basePolicy: Record<string, unknown> & { applications?: unknown[] } = {}

    try {
      const existingPolicy = await androidmanagement.enterprises.policies.get({
        name: defaultPolicyName,
      })
      basePolicy = existingPolicy.data as Record<string, unknown> & { applications?: unknown[] }
    } catch (err) {
      // Default policy might not exist, use minimal policy
      console.log('Using minimal base policy')
    }

    // Create/update device-specific policy with the app
    const existingApps = Array.isArray(basePolicy.applications) ? basePolicy.applications : []

    const policyWithApp = {
      ...basePolicy,
      applications: [
        // Include existing apps from base policy
        ...existingApps,
        // Add the new app
        {
          packageName: packageName,
          installType: 'FORCE_INSTALLED' as const,
        },
      ],
    }

    // Create or update the policy
    await androidmanagement.enterprises.policies.patch({
      name: policyName,
      requestBody: policyWithApp as Record<string, unknown>,
    })

    // Apply the policy to the device
    const deviceName = `${enterpriseName}/devices/${deviceId}`
    await androidmanagement.enterprises.devices.patch({
      name: deviceName,
      requestBody: {
        policyName: policyName,
      },
    })

    return {
      success: true,
      message: 'Application install initiated. It may take a few minutes to appear on the device.',
    }
  } catch (error) {
    console.error('Error installing app on device:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to install application',
    }
  }
}
