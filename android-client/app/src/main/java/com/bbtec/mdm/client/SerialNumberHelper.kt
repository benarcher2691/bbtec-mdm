package com.bbtec.mdm.client

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log

/**
 * Centralized helper for safely reading hardware serial numbers on Android 10+
 *
 * Handles the race condition where setPermissionGrantState() takes time to become effective.
 * Uses exponential backoff polling of getPermissionGrantState() instead of blind sleeps.
 *
 * Based on expert recommendation: poll permission state with exponential backoff up to 5 seconds.
 */
object SerialNumberHelper {

    private const val TAG = "SerialNumberHelper"

    /**
     * Safely read hardware serial number with proper permission handling
     *
     * Process:
     * 1. Grant READ_PHONE_STATE permission via DevicePolicyManager
     * 2. Poll getPermissionGrantState() with exponential backoff (up to 5 seconds)
     * 3. Only call Build.getSerial() after permission confirmed
     * 4. Validate result (reject SSAID collisions/patterns)
     *
     * @return Hardware serial number OR null if unavailable/invalid
     *         null triggers sentinel value "0" in calling code
     */
    fun readSerialSafely(context: Context): String? {
        Log.d(TAG, "═══ SAFE SERIAL READ START ═══")

        // 1. Ensure READ_PHONE_STATE permission is granted and effective
        val granted = ensurePhoneStateGranted(context)
        if (!granted) {
            Log.w(TAG, "❌ READ_PHONE_STATE never became effective after timeout")
            Log.w(TAG, "Device will report serial as '0' (permission failure)")
            return null
        }

        // 2. Get app-scoped Android ID for collision detection
        val ssaId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )
        Log.d(TAG, "SSAID (for validation): $ssaId")

        // 3. Read serial number
        val serial = try {
            Build.getSerial()
        } catch (e: SecurityException) {
            Log.w(TAG, "❌ SecurityException calling Build.getSerial() despite grant", e)
            return null
        }

        Log.d(TAG, "Build.getSerial() returned: $serial")

        // 4. Validate serial (reject SSAID collisions and patterns)
        return when {
            serial.isNullOrEmpty() -> {
                Log.w(TAG, "⚠️ Serial is null or empty")
                null
            }
            serial == "unknown" -> {
                Log.w(TAG, "⚠️ Serial is 'unknown' placeholder")
                null
            }
            serial == ssaId -> {
                Log.w(TAG, "⚠️ Serial equals SSAID - collision detected (OEM privacy behavior)")
                null
            }
            serial.matches(Regex("^[0-9a-fA-F]{16}$")) -> {
                Log.w(TAG, "⚠️ Serial looks like Android ID (16 hex chars) - likely SSAID")
                null
            }
            else -> {
                Log.d(TAG, "✅ Valid hardware serial: $serial")
                serial
            }
        }
    }

    /**
     * Grant READ_PHONE_STATE permission and poll until effective
     *
     * Uses exponential backoff: 100 → 200 → 400 → 800 → 1600 → 2000ms (~5s total)
     * Polls getPermissionGrantState() to check actual state, not just sleep.
     *
     * @return true if permission became effective within timeout, false otherwise
     */
    private fun ensurePhoneStateGranted(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
        if (dpm == null) {
            Log.e(TAG, "❌ DevicePolicyManager not available")
            return false
        }

        val admin = ComponentName(context, MdmDeviceAdminReceiver::class.java)
        val pkg = context.packageName

        // Check if we're Device Owner
        if (!dpm.isDeviceOwnerApp(pkg)) {
            Log.w(TAG, "⚠️ Not Device Owner - cannot grant READ_PHONE_STATE")
            return false
        }

        Log.d(TAG, "Granting READ_PHONE_STATE to self...")

        // Grant permission via DevicePolicyManager
        try {
            val result = dpm.setPermissionGrantState(
                admin,
                pkg,
                Manifest.permission.READ_PHONE_STATE,
                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED
            )
            Log.d(TAG, "setPermissionGrantState() returned: $result")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Exception calling setPermissionGrantState()", e)
            return false
        }

        // Poll permission state with exponential backoff
        val delays = listOf(100L, 200L, 400L, 800L, 1600L, 2000L)  // Total: ~5.1 seconds
        var totalWait = 0L

        for ((attempt, delay) in delays.withIndex()) {
            // Check current permission state
            val state = try {
                dpm.getPermissionGrantState(
                    admin,
                    pkg,
                    Manifest.permission.READ_PHONE_STATE
                )
            } catch (e: Exception) {
                Log.e(TAG, "❌ Exception calling getPermissionGrantState()", e)
                return false
            }

            if (state == DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED) {
                if (attempt == 0) {
                    Log.d(TAG, "✅ Permission ready immediately")
                } else {
                    Log.d(TAG, "✅ Permission ready after ${totalWait}ms (attempt ${attempt + 1})")
                }
                return true
            }

            // Permission not ready yet - wait with exponential backoff
            if (attempt < delays.size - 1) {
                Log.d(TAG, "⏳ Attempt ${attempt + 1}/${delays.size}: Not ready (state=$state), waiting ${delay}ms...")
                Thread.sleep(delay)
                totalWait += delay
            } else {
                Log.w(TAG, "❌ Permission never became GRANTED after ${totalWait}ms (final state=$state)")
            }
        }

        return false
    }
}
