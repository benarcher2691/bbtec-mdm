package com.bbtec.mdm.client

import android.content.Context
import android.os.SystemClock
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * Periodic WorkManager job to check PollingService health.
 *
 * Runs every 15 minutes (minimum for periodic work) + 10min flex window.
 * Treats WorkManager as best-effort backstop, not exact scheduler.
 *
 * Health Checks:
 * 1. Is PollingService running? (via in-process flag)
 * 2. When was last successful heartbeat? (monotonic clock)
 *
 * Actions:
 * - If service dead OR no heartbeat in 30min → restart service via ServiceKickWorker
 * - Otherwise → log healthy status
 *
 * Android 10+ Considerations:
 * - Doze mode and standby buckets may delay execution
 * - This is expected - service should survive independently
 * - WorkManager is recovery mechanism, not primary scheduler
 */
class HeartbeatHealthWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    companion object {
        private const val TAG = "HeartbeatHealthWorker"
        private const val MAX_SILENCE_MINUTES = 30
    }

    override fun doWork(): Result {
        Log.d(TAG, "🏥 Health check started")

        val prefsManager = PreferencesManager(applicationContext)
        val stateManager = HeartbeatStateManager(applicationContext)

        // Check 1: Is service running?
        val isServiceRunning = PollingService.isServiceRunning()
        Log.d(TAG, "Service running: $isServiceRunning")

        // Check 2: When was last successful heartbeat?
        val lastSuccessAt = stateManager.getLastSuccessAtBlocking()
        val now = SystemClock.elapsedRealtime()
        val minutesSinceSuccess = if (lastSuccessAt > 0) {
            (now - lastSuccessAt) / 60_000
        } else {
            -1L
        }

        Log.d(TAG, "Last successful heartbeat: ${minutesSinceSuccess}m ago")

        // Determine if heartbeat is unhealthy
        val isUnhealthy = when {
            !isServiceRunning -> {
                Log.w(TAG, "⚠️ Service flag says not running")
                true
            }
            lastSuccessAt > 0 && minutesSinceSuccess > MAX_SILENCE_MINUTES -> {
                Log.w(TAG, "⚠️ No heartbeat for ${minutesSinceSuccess}m (threshold: ${MAX_SILENCE_MINUTES}m)")
                true
            }
            else -> {
                Log.d(TAG, "✅ Service health OK")
                false
            }
        }

        // ALWAYS attempt restart if unhealthy (safe even if service is running)
        // This prevents stuck state where isRunning=true but service is dead
        if (isUnhealthy) {
            Log.d(TAG, "🚑 Kicking service restart (safe to call even if running)")
            PollingService.startService(applicationContext)
        }

        // Always return success - this worker should keep running
        return Result.success()
    }
}
