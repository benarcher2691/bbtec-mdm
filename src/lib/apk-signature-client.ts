/**
 * Client-side APK signature utilities
 * Parses APK files in the browser using JSZip and crypto
 */

import JSZip from 'jszip'

export interface ApkMetadata {
  packageName: string
  versionName: string
  versionCode: number
  signatureChecksum: string
}

/**
 * Parse APK file in the browser
 * Performs basic validation and extracts version from filename
 *
 * NOTE: Signature and package name extraction is now done server-side
 * via /api/apk/extract-signature using apksigner and aapt tools
 *
 * This function returns placeholder values that will be replaced by
 * server-side extraction in the upload flow.
 */
export async function parseApkMetadataClient(file: File): Promise<ApkMetadata> {
  try {
    const zip = await JSZip.loadAsync(file)

    // Validate APK structure
    const manifestFile = zip.file('AndroidManifest.xml')
    if (!manifestFile) {
      throw new Error('AndroidManifest.xml not found in APK')
    }

    // Validate certificate exists
    const certFile = zip.file(/^META-INF\/.*\.(RSA|DSA|EC)$/i)[0]
    if (!certFile) {
      throw new Error('No certificate found in META-INF/')
    }

    // Return placeholder values
    // These will be replaced by server-side extraction
    return {
      packageName: 'placeholder', // Will be extracted server-side
      versionName: extractVersionFromFilename(file.name),
      versionCode: 0, // Will be extracted server-side
      signatureChecksum: 'placeholder', // Will be extracted server-side
    }
  } catch (error) {
    console.error('APK parsing error:', error)
    throw new Error(`Failed to parse APK: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate SHA-256 checksum of certificate (URL-safe base64 without padding)
 * Required format for Android provisioning: RFC 4648 base64url without padding
 */
async function calculateSignatureChecksum(certData: Uint8Array): Promise<string> {
  // Convert to proper ArrayBuffer for crypto.subtle
  const buffer = certData.buffer.slice(certData.byteOffset, certData.byteOffset + certData.byteLength) as ArrayBuffer
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBase64 = btoa(String.fromCharCode(...hashArray))
  // Convert to URL-safe base64 without padding (RFC 4648 base64url)
  return hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Extract version from APK filename
 * e.g., "app-release-1.2.3.apk" -> "1.2.3"
 */
function extractVersionFromFilename(filename: string): string {
  const match = filename.match(/(\d+\.\d+\.\d+)/)
  return match ? match[1] : '1.0.0'
}

/**
 * Validate APK file format (ZIP signature)
 */
export async function validateApkFile(file: File): Promise<boolean> {
  try {
    const header = await file.slice(0, 4).arrayBuffer()
    const bytes = new Uint8Array(header)

    // Check ZIP signature (PK\x03\x04 or PK\x05\x06)
    return bytes[0] === 0x50 &&
           bytes[1] === 0x4B &&
           (bytes[2] === 0x03 || bytes[2] === 0x05) &&
           (bytes[3] === 0x04 || bytes[3] === 0x06)
  } catch {
    return false
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
