import { NextResponse } from 'next/server'
import { createPolicy } from '@/app/actions/android-management'

/**
 * API route to update the default policy
 * Visit /api/update-policy to trigger policy update
 */
export async function GET() {
  try {
    const result = await createPolicy('default-policy')

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Policy updated successfully. No password will be required for new enrollments.',
        policy: result.policy,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update policy',
    }, { status: 500 })
  }
}
