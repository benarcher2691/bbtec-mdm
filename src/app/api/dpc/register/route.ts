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
      serialNumber,
      androidId,
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner,
    } = await request.json()

    // Validate required fields
    if (!serialNumber || !androidId || !model || !manufacturer || !androidVersion) {
      return NextResponse.json(
        { error: 'Missing required device information' },
        { status: 400 }
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
    })

    return NextResponse.json({
      success: true,
      deviceId: serialNumber,
      apiToken: result.apiToken,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
