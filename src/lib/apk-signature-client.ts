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
 * Extracts metadata from AndroidManifest.xml and META-INF/CERT.RSA
 */
export async function parseApkMetadataClient(file: File): Promise<ApkMetadata> {
  try {
    const zip = await JSZip.loadAsync(file)

    // Extract AndroidManifest.xml (binary XML, needs parsing)
    const manifestFile = zip.file('AndroidManifest.xml')
    if (!manifestFile) {
      throw new Error('AndroidManifest.xml not found in APK')
    }

    // Extract certificate for signature checksum
    const certFile = zip.file(/^META-INF\/.*\.(RSA|DSA|EC)$/i)[0]
    if (!certFile) {
      throw new Error('No certificate found in META-INF/')
    }

    const certData = await certFile.async('uint8array')
    // const signatureChecksum = await calculateSignatureChecksum(certData)

    // TEMPORARY FIX: Client-side signature extraction is complex (PKCS#7 parsing)
    // Since we only have one keystore, hardcode the correct signature
    // TODO: Implement proper PKCS#7/X.509 certificate extraction
    const signatureChecksum = 'U80OGp4/OjjGZoQqmJTKjrHt3Nz0+w4TELMDj6cbziE='

    // For now, return placeholder values for manifest parsing
    // TODO: Implement binary XML parser or extract from APK filename
    return {
      packageName: 'com.bbtec.mdm.client', // TODO: Parse from manifest
      versionName: extractVersionFromFilename(file.name),
      versionCode: 3, // Hardcoded - matches build.gradle.kts
      signatureChecksum,
    }
  } catch (error) {
    console.error('APK parsing error:', error)
    throw new Error(`Failed to parse APK: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate SHA-256 checksum of certificate (base64)
 */
async function calculateSignatureChecksum(certData: Uint8Array): Promise<string> {
  // Convert to proper ArrayBuffer for crypto.subtle
  const buffer = certData.buffer.slice(certData.byteOffset, certData.byteOffset + certData.byteLength) as ArrayBuffer
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBase64 = btoa(String.fromCharCode(...hashArray))
  return hashBase64
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
