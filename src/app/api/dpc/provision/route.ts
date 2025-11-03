import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * DPC Provisioning Endpoint
 * Called by the Android DPC during initial device setup
 * Returns policy configuration for the device
 */
export async function POST(request: NextRequest) {
  try {
    const { enrollmentToken, deviceInfo } = await request.json()

    if (!enrollmentToken || !deviceInfo) {
      return NextResponse.json(
        { error: 'Missing enrollmentToken or deviceInfo' },
        { status: 400 }
      )
    }

    // Validate enrollment token
    const validation = await convex.query(api.enrollmentTokens.validateToken, {
      token: enrollmentToken,
    })

    if (!validation.valid || !validation.policyId) {
      return NextResponse.json(
        { error: validation.reason || 'Invalid token' },
        { status: 401 }
      )
    }

    // Get policy configuration
    const policy = await convex.query(api.policies.getPolicy, {
      policyId: validation.policyId,
    })

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      )
    }

    // Mark token as used
    await convex.mutation(api.enrollmentTokens.markTokenUsed, {
      token: enrollmentToken,
      deviceId: deviceInfo.serialNumber,
    })

    // Return policy and provisioning configuration
    return NextResponse.json({
      success: true,
      policy: {
        name: policy.name,
        passwordRequired: policy.passwordRequired,
        passwordMinLength: policy.passwordMinLength,
        passwordQuality: policy.passwordQuality,
        cameraDisabled: policy.cameraDisabled,
        screenCaptureDisabled: policy.screenCaptureDisabled,
        bluetoothDisabled: policy.bluetoothDisabled,
        usbFileTransferDisabled: policy.usbFileTransferDisabled,
        factoryResetDisabled: policy.factoryResetDisabled,
        wifiConfigs: policy.wifiConfigs,
        kioskEnabled: policy.kioskEnabled,
        kioskPackageNames: policy.kioskPackageNames,
        statusBarDisabled: policy.statusBarDisabled,
        systemAppsDisabled: policy.systemAppsDisabled,
      },
      serverUrl: validation.serverUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://bbtec-mdm.vercel.app',
      pingInterval: 15, // minutes
    })
  } catch (error) {
    console.error('Provisioning error:', error)
    return NextResponse.json(
      { error: 'Provisioning failed' },
      { status: 500 }
    )
  }
}
