import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import { requireDeviceAuth } from '@/lib/auth-device'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(request: NextRequest) {
  // Validate API token
  const auth = await requireDeviceAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid or missing API token' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { pingInterval } = body

    if (typeof pingInterval !== 'number' || pingInterval < 1 || pingInterval > 180) {
      return NextResponse.json(
        { error: 'Ping interval must be between 1 and 180 minutes' },
        { status: 400 }
      )
    }

    await convex.mutation(api.deviceClients.updatePingInterval, {
      deviceId: auth.device.deviceId,
      pingInterval,
    })

    return NextResponse.json({
      success: true,
      pingInterval,
    })
  } catch (error) {
    console.error('Update ping interval error:', error)
    return NextResponse.json(
      { error: 'Failed to update ping interval' },
      { status: 500 }
    )
  }
}
