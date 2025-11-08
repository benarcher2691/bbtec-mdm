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
      enrollmentId,
      ssaId,
      serialNumber,
      androidId,  // Legacy field for backward compatibility
      brand,
      model,
      manufacturer,
      androidVersion,
      buildFingerprint,
      isDeviceOwner,
    } = await request.json()

    console.log(`[DPC REGISTER] Device info:`, {
      enrollmentId: enrollmentId || 'MISSING',
      ssaId: ssaId?.substring(0, 8) + '...' || 'MISSING',
      serialNumber,
      androidId: androidId?.substring(0, 8) + '...' || 'MISSING',
      brand,
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
      console.error(`[DPC REGISTER] This device will be registered with '0' sentinel value`)
    }

    // VALIDATION: Detect race condition - serial equals SSAID (should NEVER happen with v0.0.34+)
    if (serialNumber && ssaId && serialNumber === ssaId && serialNumber !== '0') {
      console.error(`[DPC REGISTER] ❌❌❌ CRITICAL BUG: Serial number equals SSAID!`)
      console.error(`[DPC REGISTER] This should NEVER happen with v0.0.34+ - indicates client bug!`)
      console.error(`[DPC REGISTER] Device: ${manufacturer} ${model}, Android ${androidVersion}`)
      console.error(`[DPC REGISTER] Serial/SSAID: ${serialNumber}`)
      console.error(`[DPC REGISTER] REJECTING REGISTRATION - client must be updated`)
      return NextResponse.json(
        {
          error: 'Client bug detected: serial equals SSAID. Please update Android client to v0.0.34+',
          details: 'The Android client sent serialNumber == ssaId, which should never happen with proper validation.'
        },
        { status: 400 }
      )
    }

    // Validate required fields (v0.0.34+: enrollmentId and ssaId required)
    // Keep androidId check for backward compatibility with older clients
    if (!enrollmentToken || !model || !manufacturer || !androidVersion) {
      console.error(`[DPC REGISTER] ERROR: Missing required fields`)
      return NextResponse.json(
        { error: 'Missing required device information or enrollment token' },
        { status: 400 }
      )
    }

    // For v0.0.34+, enrollmentId and ssaId are required
    if (!enrollmentId || !ssaId) {
      console.warn(`[DPC REGISTER] ⚠️ Legacy client detected (missing enrollmentId or ssaId)`)
      console.warn(`[DPC REGISTER] Please update Android client to v0.0.34+`)

      // Fall back to old behavior for legacy clients
      if (!androidId || !serialNumber) {
        console.error(`[DPC REGISTER] ERROR: Legacy client missing androidId or serialNumber`)
        return NextResponse.json(
          { error: 'Missing required device identifiers' },
          { status: 400 }
        )
      }
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

    // Resolve or create physical device (two-table architecture)
    console.log(`[DPC REGISTER] Resolving physical device...`)
    const physicalDeviceId = await convex.mutation(api.devices.resolveDevice, {
      ssaId: ssaId || undefined,
      serialNumber: serialNumber || undefined,
      brand: brand || manufacturer,  // Use brand if available, otherwise manufacturer
      model,
      manufacturer,
      buildFingerprint: buildFingerprint || undefined,
    })

    console.log(`[DPC REGISTER] Physical device resolved: ${physicalDeviceId}`)

    // Register device enrollment (creates new or updates existing)
    // v0.0.34+: Use enrollmentId as primary key, link to physical device
    // Legacy: Fall back to androidId for older clients
    const primaryDeviceId = enrollmentId || androidId
    console.log(`[DPC REGISTER] Registering enrollment in database...`)
    console.log(`[DPC REGISTER] Primary device ID (enrollmentId): ${primaryDeviceId}`)

    const result = await convex.mutation(api.deviceClients.registerDevice, {
      deviceId: primaryDeviceId,  // enrollmentId (v0.0.34+) or androidId (legacy)
      enrollmentId: enrollmentId || undefined,
      ssaId: ssaId || undefined,
      serialNumber: serialNumber || undefined,
      androidId: androidId || undefined,  // Keep for legacy compatibility
      physicalDeviceId,  // Link to physical device
      model,
      manufacturer,
      androidVersion,
      isDeviceOwner: isDeviceOwner ?? true,
      userId: tokenData.userId, // Assign device to token creator
      policyId: tokenData.policyId, // Assign policy during registration
      companyUserId: tokenData.companyUserId, // Assign company user
    })

    console.log(`[DPC REGISTER] Enrollment registered with policy ${tokenData.policyId || 'none'}`)

    // Mark token as used
    console.log(`[DPC REGISTER] Marking token as used...`)
    await convex.mutation(api.enrollmentTokens.markTokenUsed, {
      token: enrollmentToken,
      deviceId: primaryDeviceId,  // enrollmentId or androidId
    })

    console.log(`[DPC REGISTER] SUCCESS: Device enrolled`, {
      enrollmentId: enrollmentId || 'N/A (legacy)',
      ssaId: ssaId?.substring(0, 8) + '...' || 'N/A (legacy)',
      serialNumber,
      physicalDeviceId,
      apiTokenPreview: result.apiToken.substring(0, 8) + '...',
    })

    return NextResponse.json({
      success: true,
      deviceId: primaryDeviceId,  // enrollmentId (v0.0.34+) or androidId (legacy)
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
