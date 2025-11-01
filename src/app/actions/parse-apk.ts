"use server"

import { auth } from '@clerk/nextjs/server'
import AppInfoParser from 'app-info-parser'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Server Action: Parse APK file to extract metadata
 */
export async function parseApkMetadata(fileBuffer: Buffer) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  // Create a temporary file path
  const tempFilePath = join(tmpdir(), `apk-${Date.now()}-${Math.random().toString(36).substring(7)}.apk`)

  try {
    // Write buffer to temporary file
    await writeFile(tempFilePath, fileBuffer)

    // Parse the APK file
    const parser = new AppInfoParser(tempFilePath)
    const info = await parser.parse()

    // Clean up temp file
    await unlink(tempFilePath)

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

    // Try to clean up temp file even on error
    try {
      await unlink(tempFilePath)
    } catch (unlinkError) {
      // Ignore cleanup errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse APK file',
    }
  }
}
