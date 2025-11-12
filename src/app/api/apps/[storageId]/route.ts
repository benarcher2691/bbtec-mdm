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

    console.log(`[APK DOWNLOAD] ${storageId} - SUCCESS: Preparing download`)

    // Environment-aware download strategy:
    // - Local Convex (127.0.0.1): Stream bytes through Next.js (offline-friendly)
    // - Cloud Convex: Redirect to cloud storage (efficient, no bandwidth through our server)
    const isLocalConvex = downloadUrl.includes('127.0.0.1:3210')

    if (isLocalConvex) {
      // LOCAL DEVELOPMENT: Stream APK bytes through Next.js
      // This allows offline development - device hits LAN IP, Next.js fetches from localhost Convex
      console.log(`[APK DOWNLOAD] ${storageId} - Local Convex detected, streaming bytes...`)

      try {
        // Fetch from local Convex (accessible from Next.js server)
        const response = await fetch(downloadUrl)

        if (!response.ok) {
          console.error(`[APK DOWNLOAD] ${storageId} - Failed to fetch from Convex:`, response.status)
          return NextResponse.json(
            { error: 'Failed to fetch APK from storage' },
            { status: 500 }
          )
        }

        // Get the file as a stream
        const blob = await response.blob()

        console.log(`[APK DOWNLOAD] ${storageId} - Streaming ${blob.size} bytes to device`)

        // Return the APK with proper headers for Android DownloadManager
        return new NextResponse(blob, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': 'attachment; filename="mdm.apk"',
            'Content-Length': blob.size.toString(),
            // Allow caching for faster repeated downloads during testing
            'Cache-Control': 'public, max-age=3600',
          },
        })
      } catch (error) {
        console.error(`[APK DOWNLOAD] ${storageId} - Error streaming file:`, error)
        return NextResponse.json(
          { error: 'Failed to stream APK file', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    } else {
      // CLOUD DEVELOPMENT/PRODUCTION: Redirect to Convex cloud storage
      // This is efficient - device downloads directly from Convex CDN
      console.log(`[APK DOWNLOAD] ${storageId} - Cloud Convex detected, redirecting to CDN`)
      return NextResponse.redirect(downloadUrl)
    }
  } catch (error) {
    console.error(`[APK DOWNLOAD] ERROR at ${requestTimestamp}:`, error)
    return NextResponse.json(
      { error: 'Failed to serve APK file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
