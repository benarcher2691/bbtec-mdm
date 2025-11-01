"use server"

import { auth } from '@clerk/nextjs/server'
import AppInfoParser from 'app-info-parser'

/**
 * Server Action: Parse APK file to extract metadata
 */
export async function parseApkMetadata(fileBuffer: Buffer) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    const parser = new AppInfoParser(fileBuffer)
    const info = await parser.parse()

    return {
      success: true,
      metadata: {
        name: info.application?.label?.[0] || 'Unknown App',
        packageName: info.package || '',
        versionName: info.versionName || '1.0.0',
        versionCode: info.versionCode || 1,
      },
    }
  } catch (error) {
    console.error('Error parsing APK:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse APK file',
    }
  }
}
