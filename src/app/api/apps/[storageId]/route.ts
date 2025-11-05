import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * API route to serve APK files from Convex storage
 * Used by Android provisioning to download DPC APK
 * Also used by Android Management API to download apps
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storageId: string }> }
) {
  const requestTimestamp = new Date().toISOString()

  try {
    const { storageId: storageIdParam } = await params
    const storageId = storageIdParam as Id<"_storage">

    console.log(`[APK DOWNLOAD] ${requestTimestamp} - Request received`, {
      storageId,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
    })

    // Try DPC APK first (apkStorage), then fall back to applications
    console.log(`[APK DOWNLOAD] ${storageId} - Querying apkStorage table...`)
    let downloadUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId,
    })

    if (downloadUrl) {
      console.log(`[APK DOWNLOAD] ${storageId} - Found in apkStorage`, {
        urlLength: downloadUrl.length,
        urlStart: downloadUrl.substring(0, 50),
      })
    } else {
      console.log(`[APK DOWNLOAD] ${storageId} - Not found in apkStorage, trying applications table...`)

      // If not found in apkStorage, try applications table
      downloadUrl = await convex.query(api.applications.getDownloadUrl, {
        storageId,
      })

      if (downloadUrl) {
        console.log(`[APK DOWNLOAD] ${storageId} - Found in applications table`)
      }
    }

    if (!downloadUrl) {
      console.error(`[APK DOWNLOAD] ${storageId} - ERROR: File not found in either table`)
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Increment download count (fire and forget - don't block redirect)
    console.log(`[APK DOWNLOAD] ${storageId} - Incrementing download count...`)
    convex.mutation(api.apkStorage.incrementDownloadCount, { storageId }).catch((err) => {
      console.error(`[APK DOWNLOAD] ${storageId} - Failed to increment download count:`, err)
    })

    console.log(`[APK DOWNLOAD] ${storageId} - SUCCESS: Redirecting to Convex storage`)

    // Redirect to the Convex storage URL
    return NextResponse.redirect(downloadUrl)
  } catch (error) {
    console.error(`[APK DOWNLOAD] ERROR at ${requestTimestamp}:`, error)
    return NextResponse.json(
      { error: 'Failed to serve APK file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
