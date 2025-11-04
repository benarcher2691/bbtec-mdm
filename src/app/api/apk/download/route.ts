import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

/**
 * APK Download Redirect Endpoint
 * Provides a short URL for Android provisioning QR codes
 * Redirects to the actual Convex storage URL
 *
 * NOTE: This endpoint is PUBLIC (no auth) - used during device provisioning
 */
export async function GET(request: NextRequest) {
  try {
    // Use unauthenticated client - getCurrentApk doesn't require auth
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

    // Get current APK
    const currentApk = await convex.query(api.apkStorage.getCurrentApk)

    console.log('APK download request - current APK:', currentApk ? 'found' : 'NOT FOUND')

    if (!currentApk) {
      console.error('No current APK found in database')
      return NextResponse.json(
        { error: 'No APK available' },
        { status: 404 }
      )
    }

    // Get download URL from Convex storage
    const downloadUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId: currentApk.storageId,
    })

    console.log('Download URL generated:', downloadUrl ? 'success' : 'FAILED')

    if (!downloadUrl) {
      console.error('Failed to generate download URL for storageId:', currentApk.storageId)
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    // Increment download counter (don't await - fire and forget)
    convex.mutation(api.apkStorage.incrementDownloadCount, {
      storageId: currentApk.storageId,
    }).catch(err => console.error('Failed to increment download count:', err))

    console.log('Redirecting to Convex storage URL (length:', downloadUrl.length, ')')

    // Redirect to actual Convex storage URL
    return NextResponse.redirect(downloadUrl, 302)
  } catch (error) {
    console.error('APK download error:', error)
    return NextResponse.json(
      { error: 'Failed to download APK', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
# Force Vercel rebuild - Tue Nov  4 09:17:55 AM CET 2025
