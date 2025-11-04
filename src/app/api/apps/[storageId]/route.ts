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
  try {
    const { storageId: storageIdParam } = await params
    const storageId = storageIdParam as Id<"_storage">

    // Try DPC APK first (apkStorage), then fall back to applications
    let downloadUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId,
    })

    // If not found in apkStorage, try applications table
    if (!downloadUrl) {
      downloadUrl = await convex.query(api.applications.getDownloadUrl, {
        storageId,
      })
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Redirect to the Convex storage URL
    return NextResponse.redirect(downloadUrl)
  } catch (error) {
    console.error('Error serving APK:', error)
    return NextResponse.json(
      { error: 'Failed to serve APK file' },
      { status: 500 }
    )
  }
}
