import { networkInterfaces } from 'os'

/**
 * Network detection result
 */
export interface NetworkDetectionResult {
  serverUrl: string
  environment: 'local' | 'cloud'
  isLocal: boolean
  detectedIp: string | null
  interfaceName?: string | null
  port?: number
  detectionMethod: 'configured' | 'network-interfaces' | 'fallback' | 'error-fallback'
  warning?: string
  error?: string
}

/**
 * Detects the correct server URL for the current environment
 *
 * Environment-aware:
 * - Local: Returns actual LAN IP for device connectivity
 * - Cloud (staging/prod): Returns configured NEXT_PUBLIC_APP_URL
 *
 * This is a shared utility used by both:
 * - /api/network-info API route (for client-side consumption)
 * - Server actions (for server-side QR generation)
 */
export function detectServerUrl(logPrefix = '[NETWORK-DETECTION]'): NetworkDetectionResult {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL

  console.log(`${logPrefix} Starting detection...`)
  console.log(`${logPrefix} NEXT_PUBLIC_CONVEX_URL: ${convexUrl}`)
  console.log(`${logPrefix} NEXT_PUBLIC_APP_URL: ${configuredAppUrl}`)

  // Environment detection
  const isLocalConvex = convexUrl?.includes('127.0.0.1') || convexUrl?.includes('localhost')
  const environment = isLocalConvex ? 'local' : 'cloud'

  console.log(`${logPrefix} Environment detected: ${environment}`)

  // CLOUD MODE: Use configured URL (staging/production)
  if (!isLocalConvex) {
    const cloudUrl = configuredAppUrl || 'https://bbtec-mdm.vercel.app'
    console.log(`${logPrefix} Cloud mode - using configured URL: ${cloudUrl}`)

    return {
      serverUrl: cloudUrl,
      environment: 'cloud',
      isLocal: false,
      detectedIp: null,
      detectionMethod: 'configured'
    }
  }

  // LOCAL MODE: Detect actual LAN IP
  console.log(`${logPrefix} Local mode - detecting LAN IP...`)

  try {
    const nets = networkInterfaces()
    let detectedIp: string | null = null
    let interfaceName: string | null = null

    // Log all network interfaces for debugging
    console.log(`${logPrefix} Available network interfaces:`, Object.keys(nets))

    // Find first private IPv4 address (192.168.x.x or 10.x.x.x or 172.16-31.x.x)
    for (const [name, addresses] of Object.entries(nets)) {
      if (!addresses) continue

      for (const addr of addresses) {
        console.log(`${logPrefix} Checking ${name}: ${addr.address} (${addr.family}, internal: ${addr.internal})`)

        // Skip internal (loopback) and non-IPv4
        if (addr.family !== 'IPv4' || addr.internal) {
          continue
        }

        // Prefer private network addresses
        if (
          addr.address.startsWith('192.168.') ||
          addr.address.startsWith('10.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(addr.address)
        ) {
          detectedIp = addr.address
          interfaceName = name
          break
        }
      }

      if (detectedIp) break
    }

    if (detectedIp) {
      const port = process.env.PORT || 3000
      const serverUrl = `http://${detectedIp}:${port}`

      console.log(`${logPrefix} ✅ LAN IP detected: ${detectedIp} (interface: ${interfaceName})`)
      console.log(`${logPrefix} Server URL: ${serverUrl}`)

      return {
        serverUrl,
        environment: 'local',
        isLocal: true,
        detectedIp,
        interfaceName,
        port: Number(port),
        detectionMethod: 'network-interfaces'
      }
    } else {
      // No LAN IP found - fallback to configured URL
      console.warn(`${logPrefix} ⚠️ No LAN IP found - falling back to configured URL`)
      const fallbackUrl = configuredAppUrl || 'http://localhost:3000'

      console.log(`${logPrefix} Fallback URL: ${fallbackUrl}`)

      return {
        serverUrl: fallbackUrl,
        environment: 'local',
        isLocal: true,
        detectedIp: null,
        interfaceName: null,
        detectionMethod: 'fallback',
        warning: 'No LAN IP detected - using configured URL'
      }
    }
  } catch (error) {
    console.error(`${logPrefix} ❌ Error detecting network interfaces:`, error)

    // Fallback on error
    const fallbackUrl = configuredAppUrl || 'http://localhost:3000'
    console.log(`${logPrefix} Error fallback URL: ${fallbackUrl}`)

    return {
      serverUrl: fallbackUrl,
      environment: 'local',
      isLocal: true,
      detectedIp: null,
      detectionMethod: 'error-fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
