import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * DPC Registration Endpoint
 * Called by the Android DPC after provisioning to register the device
 * Returns API token for subsequent authenticated requests
 */
export async function POST(request: NextRequest) {
  try {
    const {
      enrollmentToken,
      serialNumber,
      androidId,
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner,
    } = await request.json()

    // Validate required fields
    if (!enrollmentToken || !serialNumber || !androidId || !model || !manufacturer || !androidVersion) {
      return NextResponse.json(
        { error: 'Missing required device information or enrollment token' },
        { status: 400 }
      )
    }

    // Validate enrollment token
    const tokenData = await convex.query(api.enrollmentTokens.getByToken, {
      token: enrollmentToken,
    })

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid enrollment token' },
        { status: 401 }
      )
    }

    if (tokenData.used) {
      return NextResponse.json(
        { error: 'Enrollment token already used' },
        { status: 401 }
      )
    }

    if (tokenData.expiresAt < Date.now()) {
      return NextResponse.json(
        { error: 'Enrollment token expired' },
        { status: 401 }
      )
    }

    // Register device (creates new or updates existing)
    const result = await convex.mutation(api.deviceClients.registerDevice, {
      deviceId: serialNumber,
      serialNumber,
      androidId,
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner: isDeviceOwner ?? true,
      userId: tokenData.userId, // Assign device to token creator
    })

    // Mark token as used
    await convex.mutation(api.enrollmentTokens.markTokenUsed, {
      token: enrollmentToken,
      deviceId: serialNumber,
    })

    // Assign policy from enrollment token to device
    if (tokenData.policyId) {
      await convex.mutation(api.deviceClients.updateDevicePolicy, {
        deviceId: serialNumber,
        policyId: tokenData.policyId,
      })
    }

    return NextResponse.json({
      success: true,
      deviceId: serialNumber,
      apiToken: result.apiToken,
      policyId: tokenData.policyId,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
