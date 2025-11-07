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
    // Get both install commands AND device commands (wipe/lock/reboot)
    const installCommands = await convex.query(api.deviceClients.getPendingCommands, {
      deviceId: auth.device.deviceId,
    })

    const deviceCommands = await convex.query(api.deviceCommands.getPendingCommands, {
      deviceId: auth.device.deviceId,
    })

    // Format install commands
    const formattedInstallCommands = installCommands.map(cmd => ({
      commandId: cmd._id,
      action: 'install_apk',
      apkUrl: cmd.apkUrl,
      packageName: cmd.packageName,
    }))

    // Format device commands (wipe, lock, reboot, etc.)
    const formattedDeviceCommands = deviceCommands.map(cmd => ({
      commandId: cmd._id,
      action: cmd.commandType, // "wipe", "lock", "reboot", "update_policy"
      parameters: cmd.parameters,
    }))

    // Combine both types of commands
    const allCommands = [...formattedInstallCommands, ...formattedDeviceCommands]

    return NextResponse.json({ commands: allCommands })
  } catch (error) {
    console.error('Get commands error:', error)
    return NextResponse.json(
      { error: 'Failed to get commands' },
      { status: 500 }
    )
  }
}
