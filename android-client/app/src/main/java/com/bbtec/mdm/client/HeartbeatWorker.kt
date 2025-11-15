package com.bbtec.mdm.client

import android.content.Context
import android.util.Log
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker for periodic device heartbeats
 * Executes every 15 minutes, even during deep sleep
 *
 * Replaces Handler.postDelayed() which does not execute during deep sleep
 *
 * @since v0.0.49 (WorkManager migration)
 */
class HeartbeatWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "HeartbeatWorker"
        private const val WORK_NAME = "mdm_heartbeat_periodic"

        /**
         * Schedule periodic heartbeat work
         * Called on: device boot, registration, interval changes
         */
        fun schedule(context: Context, intervalMinutes: Long = 15) {
            Log.d(TAG, "📅 Scheduling WorkManager heartbeat every $intervalMinutes minutes")

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val heartbeatRequest = PeriodicWorkRequestBuilder<HeartbeatWorker>(
                intervalMinutes, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    heartbeatRequest
                )
        }

        /**
         * Trigger immediate one-time heartbeat
         * Used on: app open, command execution, manual triggers
         */
        fun triggerImmediate(context: Context) {
            Log.d(TAG, "🚀 Triggering immediate heartbeat")

            val immediateRequest = OneTimeWorkRequestBuilder<HeartbeatWorker>()
                .setConstraints(Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
                )
                .build()

            WorkManager.getInstance(context).enqueue(immediateRequest)
        }

        /**
         * Cancel all heartbeat work
         */
        fun cancel(context: Context) {
            Log.d(TAG, "🚫 Cancelling WorkManager heartbeat")
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.d(TAG, "🔔 WorkManager heartbeat execution started")

        val prefsManager = PreferencesManager(applicationContext)

        // Verify device is registered
        if (prefsManager.getApiToken().isEmpty()) {
            Log.w(TAG, "⚠️ No API token - device not registered yet")
            return@withContext Result.failure()
        }

        try {
            // Send heartbeat
            val apiClient = ApiClient(applicationContext)
            apiClient.sendHeartbeatSync()

            // Check for pending commands
            checkPendingCommands(apiClient, prefsManager.getDeviceId())

            Log.d(TAG, "✅ WorkManager heartbeat completed successfully")
            Result.success()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Heartbeat failed: ${e.message}", e)

            // Retry with exponential backoff (WorkManager handles automatically)
            if (runAttemptCount < 3) {
                Log.d(TAG, "🔄 Retrying (attempt ${runAttemptCount + 1}/3)")
                Result.retry()
            } else {
                Log.e(TAG, "💀 Max retries reached, giving up")
                Result.failure()
            }
        }
    }

    private suspend fun checkPendingCommands(apiClient: ApiClient, deviceId: String) {
        try {
            // TODO: Implement getPendingCommandsSync() in ApiClient
            // For now, this is a placeholder
            Log.d(TAG, "📋 Checking for pending commands...")
            // val commands = apiClient.getPendingCommandsSync()
            // if (commands.isNotEmpty()) {
            //     Log.d(TAG, "📋 Found ${commands.size} pending commands - processing")
            //     // Command processing logic (reuse from PollingService)
            // }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to check pending commands", e)
        }
    }
}
