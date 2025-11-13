import { NextResponse } from 'next/server'
import { detectServerUrl } from '@/lib/network-detection'

/**
 * Network Info API - Detects server URL for local development
 *
 * Environment-aware:
 * - Local: Returns actual LAN IP for device connectivity
 * - Cloud (staging/prod): Returns configured NEXT_PUBLIC_APP_URL
 *
 * Used by enrollment page to generate QR codes with correct server URL
 */
export async function GET() {
  const timestamp = new Date().toISOString()
  console.log(`[NETWORK-INFO] ${timestamp} - Request received`)

  // Use shared network detection utility
  const result = detectServerUrl('[NETWORK-INFO]')

  console.log(`[NETWORK-INFO] ✅ Returning result: ${result.serverUrl}`)

  return NextResponse.json(result)
}
