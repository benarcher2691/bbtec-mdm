import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * DPC Policy Fetch Endpoint
 * Returns the policy assigned to a device
 * Requires API token authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Get API token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const apiToken = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Validate API token and get device info
    const deviceInfo = await convex.query(api.deviceClients.validateToken, {
      apiToken,
    })

    if (!deviceInfo) {
      return NextResponse.json(
        { error: 'Invalid API token' },
        { status: 401 }
      )
    }

    // Get device to find its policy
    const device = await convex.query(api.deviceClients.getDevice, {
      deviceId: deviceInfo.deviceId,
    })

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    // If no policy assigned, return success with null policy
    if (!device.policyId) {
      return NextResponse.json({
        success: true,
        policy: null,
      })
    }

    // Fetch the policy
    const policy = await convex.query(api.policies.getPolicy, {
      policyId: device.policyId,
    })

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      policy: {
        name: policy.name,
        description: policy.description,

        // Password requirements
        passwordRequired: policy.passwordRequired,
        passwordMinLength: policy.passwordMinLength,
        passwordQuality: policy.passwordQuality,

        // Device restrictions
        cameraDisabled: policy.cameraDisabled,
        screenCaptureDisabled: policy.screenCaptureDisabled,
        bluetoothDisabled: policy.bluetoothDisabled,
        usbFileTransferDisabled: policy.usbFileTransferDisabled,
        factoryResetDisabled: policy.factoryResetDisabled,

        // Kiosk mode
        kioskEnabled: policy.kioskEnabled,
        kioskPackageNames: policy.kioskPackageNames || [],

        // System behavior
        statusBarDisabled: policy.statusBarDisabled,
        systemAppsDisabled: policy.systemAppsDisabled || [],
      },
    })
  } catch (error) {
    console.error('Policy fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch policy' },
      { status: 500 }
    )
  }
}
