import crypto from 'crypto'
import AppInfoParser from 'app-info-parser'

/**
 * APK Signature Utility
 * Extracts signature checksums and metadata from APK files
 * Used for Android provisioning QR codes
 */

export interface ApkMetadata {
  packageName: string
  versionName: string
  versionCode: number
  signatureChecksum: string // SHA-256 in base64
  minSdkVersion?: number
  targetSdkVersion?: number
}

/**
 * Parse APK file and extract metadata including signature checksum
 * @param apkBuffer - APK file as Buffer
 * @returns APK metadata with signature checksum
 */
export async function parseApkMetadata(apkBuffer: Buffer): Promise<ApkMetadata> {
  try {
    const parser = new AppInfoParser(apkBuffer)
    const info = await parser.parse() as any

    if (!info) {
      throw new Error('Invalid APK file')
    }

    // Extract signature certificate
    const signature = info.signature?.[0]
    if (!signature) {
      throw new Error('No signature found in APK')
    }

    // Calculate SHA-256 checksum of certificate (base64)
    const signatureChecksum = calculateSignatureChecksum(signature)

    return {
      packageName: info.package || '',
      versionName: info.versionName || '1.0',
      versionCode: info.versionCode || 1,
      signatureChecksum,
      minSdkVersion: info.minSdkVersion,
      targetSdkVersion: info.targetSdkVersion,
    }
  } catch (error) {
    console.error('Error parsing APK:', error)
    throw new Error(`Failed to parse APK: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate SHA-256 checksum of APK signature certificate
 * @param signature - Signature certificate data
 * @returns Base64-encoded SHA-256 checksum
 */
function calculateSignatureChecksum(signature: string | Buffer): string {
  const sigBuffer = typeof signature === 'string'
    ? Buffer.from(signature, 'utf-8')
    : signature

  const hash = crypto.createHash('sha256')
  hash.update(sigBuffer)
  return hash.digest('base64')
}

/**
 * Validate APK file format
 * @param apkBuffer - APK file as Buffer
 * @returns true if valid APK
 */
export function validateApkFile(apkBuffer: Buffer): boolean {
  // Check ZIP signature (APKs are ZIP archives)
  const zipSignature = apkBuffer.slice(0, 4)
  const isZip = zipSignature[0] === 0x50 &&
                zipSignature[1] === 0x4B &&
                (zipSignature[2] === 0x03 || zipSignature[2] === 0x05) &&
                (zipSignature[3] === 0x04 || zipSignature[3] === 0x06)

  if (!isZip) {
    return false
  }

  // Check minimum size (APKs are typically > 1KB)
  if (apkBuffer.length < 1024) {
    return false
  }

  return true
}

/**
 * Convert hexadecimal fingerprint to base64 (for reference)
 * @param hexFingerprint - SHA-256 fingerprint in hex format (with or without colons)
 * @returns Base64-encoded fingerprint
 */
export function hexToBase64(hexFingerprint: string): string {
  // Remove colons if present (e.g., "AB:CD:EF" -> "ABCDEF")
  const cleanHex = hexFingerprint.replace(/:/g, '')

  // Convert hex to buffer
  const buffer = Buffer.from(cleanHex, 'hex')

  // Convert to base64
  return buffer.toString('base64')
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
