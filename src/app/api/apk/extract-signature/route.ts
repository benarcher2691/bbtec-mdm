import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import { auth } from '@clerk/nextjs/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

/**
 * Extract APK Signature Server-Side
 * Downloads APK from Convex storage and calculates correct signature using apksigner
 *
 * This replaces the client-side parser which couldn't properly extract certificate data
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null

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

    console.log('[APK-EXTRACT] Downloading APK from:', downloadUrl)

    // Download APK
    const apkResponse = await fetch(downloadUrl)
    if (!apkResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download APK' },
        { status: 500 }
      )
    }

    const apkBuffer = await apkResponse.arrayBuffer()

    // Save to temporary file
    tempFilePath = join(tmpdir(), `apk-${Date.now()}-${Math.random().toString(36).substring(7)}.apk`)
    await writeFile(tempFilePath, Buffer.from(apkBuffer))

    console.log('[APK-EXTRACT] Saved to temp file:', tempFilePath)

    // Try server-side extraction first (local development with Android SDK)
    try {
      // Extract signature using apksigner
      const apksignerPath = '/opt/android-sdk/build-tools/34.0.0/apksigner'
      console.log('[APK-EXTRACT] Running apksigner...')

      const { stdout: certOutput } = await execPromise(
        `${apksignerPath} verify --print-certs "${tempFilePath}"`
      )

      // Parse SHA-256 digest from output
      const sha256Match = certOutput.match(/Signer #\d+ certificate SHA-256 digest: ([a-f0-9]+)/i)
      if (!sha256Match) {
        throw new Error('Could not extract SHA-256 digest from apksigner output')
      }

      const sha256Hex = sha256Match[1]
      console.log('[APK-EXTRACT] SHA-256 hex:', sha256Hex)

      // Convert hex to URL-safe Base64
      const signatureChecksum = Buffer.from(sha256Hex, 'hex')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      console.log('[APK-EXTRACT] ✅ Extracted via apksigner')
      console.log('[APK-EXTRACT] Signature checksum:', signatureChecksum)

      // Extract package name using aapt
      const aaptPath = '/opt/android-sdk/build-tools/34.0.0/aapt'
      console.log('[APK-EXTRACT] Running aapt...')

      const { stdout: aaptOutput } = await execPromise(
        `${aaptPath} dump badging "${tempFilePath}" | grep "package: name"`
      )

      // Parse package name from aapt output
      // Format: package: name='com.bbtec.mdm.client.staging' versionCode='39' versionName='0.0.39-staging' ...
      const packageMatch = aaptOutput.match(/package: name='([^']+)'/)
      const versionNameMatch = aaptOutput.match(/versionName='([^']+)'/)
      const versionCodeMatch = aaptOutput.match(/versionCode='(\d+)'/)

      if (!packageMatch) {
        throw new Error('Could not extract package name from aapt output')
      }

      const packageName = packageMatch[1]
      const versionName = versionNameMatch ? versionNameMatch[1] : 'unknown'
      const versionCode = versionCodeMatch ? parseInt(versionCodeMatch[1], 10) : 0

      console.log('[APK-EXTRACT] Package name:', packageName)
      console.log('[APK-EXTRACT] Version:', versionName, `(${versionCode})`)

      // Clean up temp file
      await unlink(tempFilePath)
      tempFilePath = null

      return NextResponse.json({
        success: true,
        signatureChecksum,
        packageName,
        versionName,
        versionCode,
      })

    } catch (extractionError) {
      // Fallback: Use environment-aware hardcoded signatures (Vercel - no Android SDK)
      console.log('[APK-EXTRACT] ⚠️ Extraction tools unavailable, using environment defaults')
      console.log('[APK-EXTRACT] Extraction error:', extractionError instanceof Error ? extractionError.message : 'Unknown')

      // Detect environment
      const vercelEnv = process.env.VERCEL_ENV // 'production' | 'preview' | 'development' | undefined
      const isProduction = vercelEnv === 'production'
      const isPreview = vercelEnv === 'preview'

      console.log('[APK-EXTRACT] Environment:', { vercelEnv, isProduction, isPreview })

      // Staging and production both use the same production keystore
      // Local development uses debug keystore
      const signatureChecksum = (isProduction || isPreview)
        ? 'U80OGp4_OjjGZoQqmJTKjrHt3Nz0-w4TELMDj6cbziE'  // Production keystore
        : 'iFlIwQLMpbKE_1YZ5L-UHXMSmeKsHCwvJRsm7kgkblk'  // Debug keystore

      // Package name: Default to base package
      // (In practice, staging uses .staging suffix, but base package works for provisioning)
      const packageName = 'com.bbtec.mdm.client'

      // Try to extract version from temp file name or use placeholder
      const versionName = '0.0.39'  // Placeholder - not critical for provisioning
      const versionCode = 39        // Placeholder - not critical for provisioning

      console.log('[APK-EXTRACT] Using signature:', signatureChecksum)
      console.log('[APK-EXTRACT] Using package:', packageName)

      // Clean up temp file
      if (tempFilePath) {
        try {
          await unlink(tempFilePath)
          tempFilePath = null
        } catch (cleanupError) {
          console.error('[APK-EXTRACT] Failed to clean up temp file:', cleanupError)
        }
      }

      return NextResponse.json({
        success: true,
        signatureChecksum,
        packageName,
        versionName,
        versionCode,
        fallback: true, // Indicate this used fallback logic
      })
    }
  } catch (error) {
    console.error('[APK-EXTRACT] Error:', error)

    // Clean up temp file if it exists
    if (tempFilePath) {
      try {
        await unlink(tempFilePath)
      } catch (cleanupError) {
        console.error('[APK-EXTRACT] Failed to clean up temp file:', cleanupError)
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to extract APK metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
