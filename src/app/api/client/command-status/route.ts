import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
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
    const { commandId, status, error } = body

    await convex.mutation(api.deviceClients.updateCommandStatus, {
      commandId: commandId as Id<"installCommands">,
      status,
      error,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json(
      { error: 'Status update failed' },
      { status: 500 }
    )
  }
}
