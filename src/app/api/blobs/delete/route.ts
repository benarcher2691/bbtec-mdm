import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { auth } from '@clerk/nextjs/server'

/**
 * Delete a blob from Vercel Blob Storage
 * Used when deleting APKs or applications
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { blobUrl } = await request.json()

    if (!blobUrl || typeof blobUrl !== 'string') {
      return NextResponse.json(
        { error: 'blobUrl is required' },
        { status: 400 }
      )
    }

    console.log('[BLOB DELETE] Deleting blob:', blobUrl)

    // Delete from Vercel Blob
    await del(blobUrl)

    console.log('[BLOB DELETE] Successfully deleted blob')

    return NextResponse.json({
      success: true,
      message: 'Blob deleted successfully',
    })
  } catch (error) {
    console.error('[BLOB DELETE] Error deleting blob:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete blob',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
