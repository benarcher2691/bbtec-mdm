import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../convex/_generated/api'

export async function GET() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

  try {
    const currentApk = await convex.query(api.apkStorage.getCurrentApk)

    return NextResponse.json({
      hasApk: !!currentApk,
      apk: currentApk ? {
        version: currentApk.version,
        versionCode: currentApk.versionCode,
        fileName: currentApk.fileName,
        fileSize: currentApk.fileSize,
        signatureChecksum: currentApk.signatureChecksum,
        storageIdLength: currentApk.storageId.length,
        isCurrent: currentApk.isCurrent,
      } : null
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
