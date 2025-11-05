import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'

async function getAuthenticatedConvexClient() {
  const { getToken } = await auth()
  const token = await getToken({ template: 'convex' })

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  convex.setAuth(token || '')

  return convex
}

/**
 * GET /api/debug/qr-json?policyId=xyz
 * Returns the raw QR code JSON for debugging/testing
 * If no policyId provided, uses default policy
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let policyId = searchParams.get('policyId')

    const convex = await getAuthenticatedConvexClient()

    // If no policyId provided, get default policy
    if (!policyId) {
      const defaultPolicy = await convex.query(api.policies.getDefaultPolicy)
      if (!defaultPolicy) {
        return NextResponse.json(
          { error: 'No default policy found. Please create a policy first or specify policyId parameter.' },
          { status: 400 }
        )
      }
      policyId = defaultPolicy._id
    }

    // Get current APK metadata
    const currentApk = await convex.query(api.apkStorage.getCurrentApk)

    if (!currentApk) {
      return NextResponse.json(
        { error: 'No DPC APK uploaded. Please upload the client APK first.' },
        { status: 400 }
      )
    }

    // Get direct Convex storage URL
    const apkUrl = await convex.query(api.apkStorage.getApkDownloadUrl, {
      storageId: currentApk.storageId,
    })

    if (!apkUrl || apkUrl.trim() === '') {
      return NextResponse.json(
        { error: `Failed to generate APK download URL. StorageId: ${currentApk.storageId}` },
        { status: 500 }
      )
    }

    // Create enrollment token
    const tokenId = await convex.mutation(api.enrollmentTokens.createEnrollmentToken, {
      policyId: policyId as Id<"policies">,
      expiresInSeconds: 3600,
    })

    const token = await convex.query(api.enrollmentTokens.getToken, { tokenId })

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to create enrollment token' },
        { status: 500 }
      )
    }

    // Build Android provisioning JSON (custom DPC format)
    const serverUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bbtec-mdm.vercel.app"

    const provisioningData = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.bbtec.mdm.client/com.bbtec.mdm.client.MdmDeviceAdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.bbtec.mdm.client",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": apkUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": currentApk.signatureChecksum,
      "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        "server_url": serverUrl,
        "enrollment_token": token.token,
      }
    }

    return NextResponse.json({
      success: true,
      qr_json: provisioningData,
      metadata: {
        apk_version: currentApk.version,
        enrollment_token: token.token,
        expires_at: new Date(token.expiresAt).toISOString(),
        json_length: JSON.stringify(provisioningData).length,
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    console.error('Error generating QR JSON:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate QR JSON',
      },
      { status: 500 }
    )
  }
}
