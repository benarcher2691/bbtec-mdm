package com.bbtec.mdm.client

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Handles system broadcasts to ensure service resilience.
 *
 * Broadcasts handled:
 * - BOOT_COMPLETED: Device restarted
 * - MY_PACKAGE_REPLACED: App updated/reinstalled
 * - USER_UNLOCKED: User unlocked device (Direct Boot)
 *
 * Actions:
 * - Start PollingService
 * - Reschedule WorkManager periodic health check (survives app updates)
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                Log.d(TAG, "📱 BOOT_COMPLETED received - starting service and scheduling WorkManager")
                startService(context)
                schedulePeriodicHealthCheck(context)
            }

            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                Log.d(TAG, "📦 MY_PACKAGE_REPLACED received - app updated, rescheduling WorkManager")
                // Service should already be running, but reschedule WorkManager to be safe
                schedulePeriodicHealthCheck(context)
                // Optionally restart service to pick up any service changes
                startService(context)
            }

            Intent.ACTION_USER_UNLOCKED -> {
                Log.d(TAG, "🔓 USER_UNLOCKED received - user unlocked device")
                // Start service if not already running (Direct Boot scenario)
                if (!PollingService.isServiceRunning()) {
                    startService(context)
                }
            }

            else -> {
                Log.w(TAG, "⚠️ Unknown broadcast action: ${intent.action}")
            }
        }
    }

    private fun startService(context: Context) {
        Log.d(TAG, "🚀 Starting PollingService")
        PollingService.startService(context)
    }

    /**
     * Schedules periodic WorkManager health check.
     *
     * Configuration:
     * - Period: 15 minutes (minimum for periodic work)
     * - Flex window: 10 minutes (allows system batching for battery efficiency)
     * - Policy: KEEP (don't recreate if already exists)
     */
    private fun schedulePeriodicHealthCheck(context: Context) {
        Log.d(TAG, "📅 Scheduling periodic health check (15min + 10min flex)")

        val healthCheckRequest = PeriodicWorkRequestBuilder<HeartbeatHealthWorker>(
            repeatInterval = 15,
            repeatIntervalTimeUnit = TimeUnit.MINUTES,
            flexTimeInterval = 10,
            flexTimeIntervalUnit = TimeUnit.MINUTES
        ).build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "mdm-heartbeat-health-check",
            ExistingPeriodicWorkPolicy.KEEP,  // Don't recreate if exists
            healthCheckRequest
        )

        Log.d(TAG, "✅ WorkManager health check scheduled")
    }
}
