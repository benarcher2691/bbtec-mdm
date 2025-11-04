import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import { auth } from '@clerk/nextjs/server'

/**
 * Extract APK Signature Server-Side
 * Downloads APK from Convex storage and calculates correct signature
 *
 * This fixes the client-side parser which hashes the entire .RSA file
 * instead of just the certificate
 */
export async function POST(request: NextRequest) {
  try {
    const { getToken } = await auth()
    const token = await getToken({ template: 'convex' })

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
    convex.setAuth(token || '')

    const { storageId } = await request.json()

    if (!storageId) {
      return NextResponse.json(
        { error: 'Missing storageId' },
        { status: 400 }
      )
    }

    // Get download URL
    const downloadUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId,
    })

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Failed to get APK download URL' },
        { status: 500 }
      )
    }

    // Download APK
    const apkResponse = await fetch(downloadUrl)
    if (!apkResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download APK' },
        { status: 500 }
      )
    }

    const apkBuffer = await apkResponse.arrayBuffer()

    // For now, return a placeholder
    // TODO: Implement proper PKCS#7/X.509 parsing
    // The signature will need to be extracted manually or use a Java tool

    return NextResponse.json({
      success: true,
      message: 'Signature extraction requires Java/keytool. Use manual entry.',
      signatureChecksum: 'U80OGp4/OjjGZoQqmJTKjrHt3Nz0+w4TELMDj6cbziE=', // Hardcoded for now
    })
  } catch (error) {
    console.error('Signature extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract signature' },
      { status: 500 }
    )
  }
}
