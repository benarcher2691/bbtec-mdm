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
    await convex.mutation(api.deviceClients.updateHeartbeat, {
      deviceId: auth.device.deviceId,
    })

    return NextResponse.json({
      success: true,
      pingInterval: auth.device.pingInterval,
    })
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json(
      { error: 'Heartbeat failed' },
      { status: 500 }
    )
  }
}
