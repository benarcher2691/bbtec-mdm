import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import { requireDeviceAuth } from '@/lib/auth-device'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET(request: NextRequest) {
  // Validate API token
  const auth = await requireDeviceAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid or missing API token' },
      { status: 401 }
    )
  }

  try {
    const commands = await convex.query(api.deviceClients.getPendingCommands, {
      deviceId: auth.device.deviceId,
    })

    // Format for Android client
    const formattedCommands = commands.map(cmd => ({
      commandId: cmd._id,
      action: 'install_apk',
      apkUrl: cmd.apkUrl,
      packageName: cmd.packageName,
    }))

    return NextResponse.json({ commands: formattedCommands })
  } catch (error) {
    console.error('Get commands error:', error)
    return NextResponse.json(
      { error: 'Failed to get commands' },
      { status: 500 }
    )
  }
}
