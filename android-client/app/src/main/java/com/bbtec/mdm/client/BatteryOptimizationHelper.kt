package com.bbtec.mdm.client

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/**
 * Helper to request battery optimization exemption for persistent background service.
 *
 * Android 10+ Considerations:
 * - Doze mode and App Standby Buckets aggressively restrict background work
 * - Battery whitelist allows service to run more reliably
 * - This is critical for MDM apps that need to maintain heartbeat
 *
 * Usage:
 * - Check if already whitelisted: isIgnoringBatteryOptimizations()
 * - Request exemption: requestBatteryOptimizationExemption()
 * - Show in diagnostics screen to allow re-request
 *
 * UX Best Practices:
 * - Show educational explanation before requesting
 * - Explain why MDM needs this permission
 * - Don't repeatedly prompt (respect user's choice)
 */
class BatteryOptimizationHelper(private val context: Context) {

    companion object {
        private const val TAG = "BatteryOptHelper"
        private const val BATTERY_OPT_REQUEST_CODE = 1001
    }

    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager

    /**
     * Checks if app is whitelisted from battery optimizations.
     * @return true if whitelisted, false otherwise
     */
    fun isIgnoringBatteryOptimizations(): Boolean {
        val packageName = context.packageName
        val isIgnoring = powerManager.isIgnoringBatteryOptimizations(packageName)
        Log.d(TAG, "Battery optimization status: ${if (isIgnoring) "WHITELISTED" else "RESTRICTED"}")
        return isIgnoring
    }

    /**
     * Requests battery optimization exemption.
     *
     * Shows system dialog asking user to whitelist the app.
     * Must be called from an Activity context to handle result.
     *
     * @param activity Activity context for launching intent
     * @return true if request was launched, false if already whitelisted
     */
    @SuppressLint("BatteryLife")
    fun requestBatteryOptimizationExemption(activity: Activity): Boolean {
        if (isIgnoringBatteryOptimizations()) {
            Log.d(TAG, "✅ Already whitelisted - no action needed")
            return false
        }

        try {
            Log.d(TAG, "🔋 Requesting battery optimization exemption")

            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
            }

            activity.startActivityForResult(intent, BATTERY_OPT_REQUEST_CODE)
            Log.d(TAG, "📱 Battery optimization dialog launched")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to request battery optimization exemption", e)
            return false
        }
    }

    /**
     * Opens battery settings screen where user can manually whitelist app.
     * Fallback if requestBatteryOptimizationExemption() fails.
     */
    fun openBatterySettings(activity: Activity) {
        try {
            Log.d(TAG, "⚙️ Opening battery settings")

            val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            activity.startActivity(intent)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to open battery settings", e)

            // Ultimate fallback: open app settings
            try {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${context.packageName}")
                }
                activity.startActivity(intent)
            } catch (e2: Exception) {
                Log.e(TAG, "❌ Failed to open app settings", e2)
            }
        }
    }

    /**
     * Gets human-readable status for diagnostics screen.
     */
    fun getStatusText(): String {
        return if (isIgnoringBatteryOptimizations()) {
            "✅ Battery optimization: EXEMPTED"
        } else {
            "⚠️ Battery optimization: RESTRICTED"
        }
    }

    /**
     * Gets detailed explanation for user education.
     */
    fun getExplanation(): String {
        return """
            MDM Background Service

            This app needs to run continuously in the background to:
            • Maintain heartbeat connection with MDM server
            • Receive and execute management commands
            • Apply security policies

            Battery optimization can prevent the service from running reliably.
            Please allow this app to run unrestricted.
        """.trimIndent()
    }
}
