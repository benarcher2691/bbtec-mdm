package com.bbtec.mdm.client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * Lightweight foreground service for MDM client
 *
 * v0.0.49+: WorkManager migration
 * - No longer uses Handler.postDelayed() for heartbeats
 * - WorkManager handles periodic heartbeats (survives deep sleep)
 * - This service only maintains foreground notification
 *
 * @since v0.0.1 (original Handler-based implementation)
 * @since v0.0.49 (refactored to WorkManager-only)
 */
class PollingService : Service() {

    private lateinit var prefsManager: PreferencesManager
    private lateinit var notificationManager: NotificationManager

    companion object {
        private const val TAG = "PollingService"
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "mdm_service_channel"

        fun startService(context: Context) {
            Log.d(TAG, "startService called")
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // Android 8+ requires startForegroundService
                    context.startForegroundService(Intent(context, PollingService::class.java))
                } else {
                    context.startService(Intent(context, PollingService::class.java))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start PollingService", e)
            }
        }

        fun stopService(context: Context) {
            Log.d(TAG, "stopService called")
            context.stopService(Intent(context, PollingService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "✨ onCreate - starting as foreground service")

        // Initialize managers
        prefsManager = PreferencesManager(this)
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create foreground notification
        createNotificationChannel()
        val notification = createNotification("MDM Client Active")
        startForeground(NOTIFICATION_ID, notification)
        Log.d(TAG, "✅ Started as foreground service")

        // Schedule WorkManager heartbeat
        val intervalMinutes = prefsManager.getPingInterval().toLong()
        HeartbeatWorker.schedule(this, intervalMinutes)
        Log.d(TAG, "📅 WorkManager heartbeat scheduled (${intervalMinutes} min interval)")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand - triggering immediate heartbeat")

        // Trigger immediate heartbeat via WorkManager
        HeartbeatWorker.triggerImmediate(this)

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.w(TAG, "⚠️ onDestroy called - WorkManager will continue")
        super.onDestroy()
        // NOTE: WorkManager continues even if service is destroyed
        // This is by design - WorkManager is independent of service lifecycle
    }

    /**
     * Creates notification channel for foreground service.
     * Required for Android 8.0+ (API 26+).
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "MDM Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps MDM client running in background"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Creates persistent foreground notification.
     */
    private fun createNotification(message: String): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("BBTec MDM")
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // TODO: Replace with app icon
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
