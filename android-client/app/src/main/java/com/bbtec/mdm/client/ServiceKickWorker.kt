package com.bbtec.mdm.client

import android.content.Context
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * One-off WorkManager job to safely restart PollingService.
 *
 * Used when service dies unexpectedly (onDestroy, watchdog timeout, app swipe).
 * Handles background start restrictions by using WorkManager context.
 *
 * Android 10+ Note:
 * - No "expedited" flag needed (Android 12+ feature)
 * - On Android 10, this runs as normal work
 * - WorkManager handles foreground service start from background safely
 *
 * Usage:
 * - Scheduled via PollingService.scheduleServiceKick()
 * - Unique work name: "mdm-service-kick"
 * - Policy: REPLACE (cancel previous, start new)
 */
class ServiceKickWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    companion object {
        private const val TAG = "ServiceKickWorker"
    }

    override fun doWork(): Result {
        Log.d(TAG, "🚀 ServiceKickWorker started - attempting service restart")

        try {
            // Check if service is already running
            if (PollingService.isServiceRunning()) {
                Log.d(TAG, "✅ Service already running - no action needed")
                return Result.success()
            }

            // Start the service
            Log.d(TAG, "🔄 Starting PollingService...")
            PollingService.startService(applicationContext)

            Log.d(TAG, "✅ Service start initiated successfully")
            return Result.success()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to start service", e)
            // Retry on failure (WorkManager will handle backoff)
            return Result.retry()
        }
    }
}
