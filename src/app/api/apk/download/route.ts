import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * APK Download Redirect Endpoint
 * Provides a short URL for Android provisioning QR codes
 * Redirects to the actual Convex storage URL
 */
export async function GET(request: NextRequest) {
  try {
    // Get current APK
    const currentApk = await convex.query(api.apkStorage.getCurrentApk)

    if (!currentApk) {
      return NextResponse.json(
        { error: 'No APK available' },
        { status: 404 }
      )
    }

    // Get download URL from Convex storage
    const downloadUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId: currentApk.storageId,
    })

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    // Increment download counter
    await convex.mutation(api.apkStorage.incrementDownloadCount, {
      storageId: currentApk.storageId,
    })

    // Redirect to actual Convex storage URL
    return NextResponse.redirect(downloadUrl, 302)
  } catch (error) {
    console.error('APK download error:', error)
    return NextResponse.json(
      { error: 'Failed to download APK' },
      { status: 500 }
    )
  }
}
