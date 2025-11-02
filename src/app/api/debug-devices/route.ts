import { NextResponse } from 'next/server'
import { listDevices } from '@/app/actions/android-management'
import { auth } from '@clerk/nextjs/server'

/**
 * Debug endpoint to check what devices are in Android Management API
 */
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const result = await listDevices()

    return NextResponse.json({
      success: result.success,
      deviceCount: result.devices.length,
      devices: result.devices.map(device => ({
        name: device.name,
        enrollmentTime: device.enrollmentTime,
        lastStatusReportTime: device.lastStatusReportTime,
        state: device.state,
        appliedState: device.appliedState,
        model: device.hardwareInfo?.model,
        manufacturer: device.hardwareInfo?.manufacturer,
      })),
      error: result.error,
    }, { status: 200 })
  } catch (error) {
    console.error('Debug devices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
