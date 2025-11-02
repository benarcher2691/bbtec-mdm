import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get('deviceId')
    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
    }

    const commands = await convex.query(api.deviceClients.getPendingCommands, {
      deviceId,
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
