import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * API route to serve APK files from Vercel Blob storage
 * Used by Android provisioning to download DPC APK
 * Also used by Android Management API to download apps
 *
 * NEW: Redirects to Vercel Blob URLs instead of streaming from Convex
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storageId: string }> }
) {
  const requestTimestamp = new Date().toISOString()

  try {
    const { storageId: storageIdParam } = await params
    const apkId = storageIdParam as Id<"apkMetadata">

    console.log(`[APK DOWNLOAD] ${requestTimestamp} - Request received`, {
      apkId,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
    })

    // SECURITY: Validate enrollment token
    const { searchParams } = new URL(request.url)
    const enrollmentToken = searchParams.get('token')

    if (!enrollmentToken) {
      console.error(`[APK DOWNLOAD] ${apkId} - ERROR: No enrollment token provided`)
      return NextResponse.json(
        { error: 'Enrollment token required. APK downloads must include a valid enrollment token.' },
        { status: 401 }
      )
    }

    console.log(`[APK DOWNLOAD] ${apkId} - Validating enrollment token: ${enrollmentToken.substring(0, 8)}...`)

    // Validate enrollment token (but don't mark as used - that happens during device registration)
    const tokenData = await convex.query(api.enrollmentTokens.getByToken, {
      token: enrollmentToken,
    })

    if (!tokenData) {
      console.error(`[APK DOWNLOAD] ${apkId} - ERROR: Token not found`)
      return NextResponse.json(
        { error: 'Invalid enrollment token' },
        { status: 401 }
      )
    }

    if (tokenData.used) {
      console.warn(`[APK DOWNLOAD] ${apkId} - WARNING: Token already used (allowing APK download for re-provisioning)`)
      // Note: We allow downloads even if token is used, to support re-provisioning scenarios
      // The device registration will fail if the token is already used, which is the real security check
    }

    if (tokenData.expiresAt < Date.now()) {
      console.error(`[APK DOWNLOAD] ${apkId} - ERROR: Token expired at ${new Date(tokenData.expiresAt).toISOString()}`)
      return NextResponse.json(
        { error: 'Enrollment token expired' },
        { status: 401 }
      )
    }

    console.log(`[APK DOWNLOAD] ${apkId} - Token validation passed`)

    // Get APK metadata (contains blobUrl)
    console.log(`[APK DOWNLOAD] ${apkId} - Fetching APK metadata...`)
    const apk = await convex.query(api.apkStorage.getApkBlobUrl, {
      apkId,
    })

    if (!apk) {
      console.error(`[APK DOWNLOAD] ${apkId} - ERROR: APK not found`)
      return NextResponse.json(
        { error: 'APK not found' },
        { status: 404 }
      )
    }

    console.log(`[APK DOWNLOAD] ${apkId} - Found blob URL:`, apk)

    // Increment download count (fire and forget - don't block redirect)
    console.log(`[APK DOWNLOAD] ${apkId} - Incrementing download count...`)
    convex.mutation(api.apkStorage.incrementDownloadCount, { apkId }).catch((err) => {
      console.error(`[APK DOWNLOAD] ${apkId} - Failed to increment download count:`, err)
    })

    console.log(`[APK DOWNLOAD] ${apkId} - SUCCESS: Redirecting to Vercel Blob`)

    // Redirect to Vercel Blob URL (CDN-backed, fast, no bandwidth cost for us!)
    return NextResponse.redirect(apk)
  } catch (error) {
    console.error(`[APK DOWNLOAD] ERROR at ${requestTimestamp}:`, error)
    return NextResponse.json(
      { error: 'Failed to serve APK file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
