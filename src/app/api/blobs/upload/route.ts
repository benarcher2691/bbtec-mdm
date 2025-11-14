import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * Upload handler for Vercel Blob client uploads
 * Validates auth and returns upload URL
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        console.log('[BLOB UPLOAD] Generating token for:', pathname)
        // Configure upload options on server side
        return {
          allowedContentTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
          addRandomSuffix: true, // Prevent filename collisions
          tokenPayload: JSON.stringify({
            userId,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('[BLOB UPLOAD] Upload completed:', blob.url)
        // Optional: Log upload to database
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('[BLOB UPLOAD] Error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
