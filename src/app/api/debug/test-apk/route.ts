import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Debug endpoint to test APK download path
 * Returns current APK info and download URL
 */
export async function GET() {
  try {
    console.log('[DEBUG TEST-APK] Fetching current APK...')

    // Get current APK
    const currentApk = await convex.query(api.apkStorage.getCurrentApk)

    if (!currentApk) {
      console.error('[DEBUG TEST-APK] No current APK found')
      return NextResponse.json({
        success: false,
        error: 'No current APK uploaded',
      })
    }

    console.log('[DEBUG TEST-APK] Current APK found:', {
      version: currentApk.version,
      versionCode: currentApk.versionCode,
      storageId: currentApk.storageId,
      signatureChecksum: currentApk.signatureChecksum,
    })

    // Get download URL
    const downloadUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId: currentApk.storageId,
    })

    if (!downloadUrl) {
      console.error('[DEBUG TEST-APK] Failed to get download URL')
      return NextResponse.json({
        success: false,
        error: 'Failed to generate download URL',
        apkInfo: currentApk,
      })
    }

    console.log('[DEBUG TEST-APK] Download URL generated successfully')

    // Build short URL
    const serverUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bbtec-mdm.vercel.app'
    const shortUrl = `${serverUrl}/api/apps/${currentApk.storageId}`

    // Test the short URL by making a HEAD request
    try {
      const testResponse = await fetch(shortUrl, { method: 'HEAD' })
      console.log('[DEBUG TEST-APK] Short URL test:', {
        status: testResponse.status,
        ok: testResponse.ok,
      })
    } catch (err) {
      console.error('[DEBUG TEST-APK] Failed to test short URL:', err)
    }

    return NextResponse.json({
      success: true,
      apk: {
        version: currentApk.version,
        versionCode: currentApk.versionCode,
        fileName: currentApk.fileName,
        fileSize: currentApk.fileSize,
        signatureChecksum: currentApk.signatureChecksum,
        uploadedAt: new Date(currentApk.uploadedAt).toISOString(),
        downloadCount: currentApk.downloadCount,
      },
      urls: {
        short: shortUrl,
        direct: downloadUrl,
      },
      qrPayload: {
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': 'com.bbtec.mdm.client/.MdmDeviceAdminReceiver',
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': shortUrl,
        'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': currentApk.signatureChecksum,
      },
    })
  } catch (error) {
    console.error('[DEBUG TEST-APK] ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
