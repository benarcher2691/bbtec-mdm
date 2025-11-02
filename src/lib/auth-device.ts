import { NextRequest } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Validate device API token from Authorization header
 * Returns device info if valid, null if invalid
 */
export async function validateDeviceToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const device = await convex.query(api.deviceClients.validateToken, {
      apiToken: token,
    })

    return device
  } catch (error) {
    console.error('Token validation error:', error)
    return null
  }
}

/**
 * Middleware helper to require device authentication
 * Returns 401 if not authenticated, otherwise returns device info
 */
export async function requireDeviceAuth(request: NextRequest) {
  const device = await validateDeviceToken(request)

  if (!device) {
    return {
      authenticated: false as const,
      device: null,
    }
  }

  return {
    authenticated: true as const,
    device,
  }
}
