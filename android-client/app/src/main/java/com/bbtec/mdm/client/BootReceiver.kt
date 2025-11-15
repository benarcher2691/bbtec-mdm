package com.bbtec.mdm.client

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Handles system broadcasts to ensure service resilience.
 *
 * Broadcasts handled:
 * - BOOT_COMPLETED: Device restarted
 * - MY_PACKAGE_REPLACED: App updated/reinstalled
 * - USER_UNLOCKED: User unlocked device (Direct Boot)
 *
 * Actions (v0.0.49+):
 * - Schedule WorkManager heartbeat (survives deep sleep, app updates, reboots)
 * - Start PollingService (optional foreground notification)
 *
 * @since v0.0.1 (original implementation)
 * @since v0.0.49 (WorkManager migration)
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                Log.d(TAG, "📱 BOOT_COMPLETED - scheduling WorkManager heartbeat")

                val prefsManager = PreferencesManager(context)
                if (prefsManager.isRegistered()) {
                    val intervalMinutes = prefsManager.getPingInterval().toLong()
                    HeartbeatWorker.schedule(context, intervalMinutes)

                    // Optional: Start foreground service for notification
                    PollingService.startService(context)

                    Log.d(TAG, "✅ WorkManager scheduled (${intervalMinutes} min interval)")
                } else {
                    Log.d(TAG, "⚠️ Device not registered yet - skipping WorkManager schedule")
                }
            }

            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                Log.d(TAG, "📦 MY_PACKAGE_REPLACED - rescheduling WorkManager after app update")

                val prefsManager = PreferencesManager(context)
                if (prefsManager.isRegistered()) {
                    val intervalMinutes = prefsManager.getPingInterval().toLong()
                    HeartbeatWorker.schedule(context, intervalMinutes)

                    // Restart service to pick up any service changes
                    PollingService.startService(context)

                    Log.d(TAG, "✅ WorkManager rescheduled after app update")
                } else {
                    Log.d(TAG, "⚠️ Device not registered yet - skipping WorkManager schedule")
                }
            }

            Intent.ACTION_USER_UNLOCKED -> {
                Log.d(TAG, "🔓 USER_UNLOCKED - checking if WorkManager needs scheduling")

                val prefsManager = PreferencesManager(context)
                if (prefsManager.isRegistered()) {
                    // Ensure WorkManager is scheduled (Direct Boot scenario)
                    val intervalMinutes = prefsManager.getPingInterval().toLong()
                    HeartbeatWorker.schedule(context, intervalMinutes)

                    PollingService.startService(context)
                }
            }

            else -> {
                Log.w(TAG, "⚠️ Unknown broadcast action: ${intent.action}")
            }
        }
    }
}
