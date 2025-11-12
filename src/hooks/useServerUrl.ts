'use client'

import { useState, useEffect } from 'react'

/**
 * Network Info Response from /api/network-info
 */
interface NetworkInfo {
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
 * Hook to get the correct server URL for the current environment
 *
 * Environment-aware:
 * - Local: Fetches actual LAN IP from /api/network-info
 * - Cloud (staging/prod): Uses NEXT_PUBLIC_APP_URL
 *
 * Used by enrollment page and anywhere server URL is needed
 */
export function useServerUrl() {
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNetworkInfo() {
      const timestamp = new Date().toISOString()
      console.log(`[SERVER-URL] ${timestamp} - Fetching network info...`)

      try {
        const response = await fetch('/api/network-info')

        if (!response.ok) {
          throw new Error(`Network info API returned ${response.status}`)
        }

        const data: NetworkInfo = await response.json()

        console.log(`[SERVER-URL] Environment: ${data.environment}`)
        console.log(`[SERVER-URL] Is Local: ${data.isLocal}`)
        console.log(`[SERVER-URL] Detection Method: ${data.detectionMethod}`)
        console.log(`[SERVER-URL] Server URL: ${data.serverUrl}`)

        if (data.detectedIp) {
          console.log(`[SERVER-URL] Detected LAN IP: ${data.detectedIp} (${data.interfaceName})`)
        }

        if (data.warning) {
          console.warn(`[SERVER-URL] ⚠️ Warning: ${data.warning}`)
        }

        if (data.error) {
          console.error(`[SERVER-URL] ❌ Error from API: ${data.error}`)
        }

        setNetworkInfo(data)
        setServerUrl(data.serverUrl)
        setLoading(false)

        console.log(`[SERVER-URL] ✅ Using server URL: ${data.serverUrl}`)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[SERVER-URL] ❌ Failed to fetch network info:`, err)

        // Fallback to NEXT_PUBLIC_APP_URL from env
        const fallbackUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        console.log(`[SERVER-URL] Using fallback URL: ${fallbackUrl}`)

        setError(errorMessage)
        setServerUrl(fallbackUrl)
        setLoading(false)
      }
    }

    fetchNetworkInfo()
  }, [])

  return {
    /** The detected or configured server URL */
    serverUrl,
    /** Full network info from API */
    networkInfo,
    /** Whether network info is being fetched */
    loading,
    /** Error message if fetch failed */
    error,
    /** Whether we're in local development mode */
    isLocal: networkInfo?.isLocal ?? false,
    /** The detected LAN IP (local mode only) */
    detectedIp: networkInfo?.detectedIp ?? null,
  }
}
