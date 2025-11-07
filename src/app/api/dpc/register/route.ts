import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * DPC Registration Endpoint
 * Called by the Android DPC after provisioning to register the device
 * Returns API token for subsequent authenticated requests
 */
export async function POST(request: NextRequest) {
  const requestTimestamp = new Date().toISOString()

  try {
    console.log(`[DPC REGISTER] ${requestTimestamp} - Registration request received`)

    const {
      enrollmentToken,
      serialNumber,
      androidId,
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner,
    } = await request.json()

    console.log(`[DPC REGISTER] Device info:`, {
      serialNumber,
      androidId: androidId?.substring(0, 8) + '...',
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner,
      hasToken: !!enrollmentToken,
      tokenPreview: enrollmentToken ? enrollmentToken.substring(0, 8) + '...' : 'MISSING',
    })

    // VALIDATION: Detect permission failure sentinel value
    if (serialNumber === '0') {
      console.error(`[DPC REGISTER] ⚠️ PERMISSION FAILURE DETECTED: Serial number is '0' (sentinel value)`)
      console.error(`[DPC REGISTER] This indicates READ_PHONE_STATE permission was never granted on device`)
      console.error(`[DPC REGISTER] Device: ${manufacturer} ${model}, Android ${androidVersion}`)
      console.error(`[DPC REGISTER] This device will be registered but with invalid serial number`)
    }

    // VALIDATION: Detect race condition - serial equals Android ID
    if (serialNumber === androidId && serialNumber !== '0') {
      console.warn(`[DPC REGISTER] ⚠️ RACE CONDITION DETECTED: Serial number equals Android ID`)
      console.warn(`[DPC REGISTER] This should not happen with the retry logic - indicates system issue`)
      console.warn(`[DPC REGISTER] Device: ${manufacturer} ${model}, Android ${androidVersion}`)
      console.warn(`[DPC REGISTER] Serial/Android ID: ${serialNumber}`)
    }

    // Validate required fields
    if (!enrollmentToken || !serialNumber || !androidId || !model || !manufacturer || !androidVersion) {
      console.error(`[DPC REGISTER] ERROR: Missing required fields`)
      return NextResponse.json(
        { error: 'Missing required device information or enrollment token' },
        { status: 400 }
      )
    }

    // Validate enrollment token
    console.log(`[DPC REGISTER] Validating enrollment token...`)
    const tokenData = await convex.query(api.enrollmentTokens.getByToken, {
      token: enrollmentToken,
    })

    if (!tokenData) {
      console.error(`[DPC REGISTER] ERROR: Token not found in database`)
      return NextResponse.json(
        { error: 'Invalid enrollment token' },
        { status: 401 }
      )
    }

    console.log(`[DPC REGISTER] Token found:`, {
      used: tokenData.used,
      expired: tokenData.expiresAt < Date.now(),
      expiresAt: new Date(tokenData.expiresAt).toISOString(),
      policyId: tokenData.policyId,
    })

    if (tokenData.used) {
      console.error(`[DPC REGISTER] ERROR: Token already used`)
      return NextResponse.json(
        { error: 'Enrollment token already used' },
        { status: 401 }
      )
    }

    if (tokenData.expiresAt < Date.now()) {
      console.error(`[DPC REGISTER] ERROR: Token expired`)
      return NextResponse.json(
        { error: 'Enrollment token expired' },
        { status: 401 }
      )
    }

    // Register device (creates new or updates existing)
    // Pass policyId and companyUserId directly to avoid authentication issues
    // Note: deviceId is now Android ID (changes on factory reset for security)
    console.log(`[DPC REGISTER] Registering device in database...`)
    const result = await convex.mutation(api.deviceClients.registerDevice, {
      deviceId: androidId,  // Android ID as primary identifier
      serialNumber,
      androidId,
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner: isDeviceOwner ?? true,
      userId: tokenData.userId, // Assign device to token creator
      policyId: tokenData.policyId, // Assign policy during registration
      companyUserId: tokenData.companyUserId, // Assign company user
    })

    console.log(`[DPC REGISTER] Device registered with policy ${tokenData.policyId || 'none'}`)

    // Mark token as used
    console.log(`[DPC REGISTER] Marking token as used...`)
    await convex.mutation(api.enrollmentTokens.markTokenUsed, {
      token: enrollmentToken,
      deviceId: androidId,  // Android ID is now the primary identifier
    })

    console.log(`[DPC REGISTER] SUCCESS: Device registered`, {
      deviceId: androidId,
      serialNumber,
      apiTokenPreview: result.apiToken.substring(0, 8) + '...',
    })

    return NextResponse.json({
      success: true,
      deviceId: androidId,  // Return Android ID as deviceId
      apiToken: result.apiToken,
      policyId: tokenData.policyId,
    })
  } catch (error) {
    console.error(`[DPC REGISTER] ERROR at ${requestTimestamp}:`, error)
    return NextResponse.json(
      { error: 'Registration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
