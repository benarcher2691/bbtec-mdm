package com.bbtec.mdm.client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class PollingService : Service() {

    private val pollingThread = HandlerThread("PollingThread")
    private lateinit var pollingHandler: Handler
    private lateinit var watchdogHandler: Handler
    private lateinit var prefsManager: PreferencesManager
    private lateinit var apiClient: ApiClient
    private lateinit var stateManager: HeartbeatStateManager
    private lateinit var notificationManager: NotificationManager

    companion object {
        private const val TAG = "PollingService"
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "mdm_service_channel"

        // Liveness flag for WorkManager health checks
        @Volatile
        private var isRunning = false

        /**
         * Check if service is running (for WorkManager health checks).
         * Uses in-process flag instead of unreliable ActivityManager.
         */
        fun isServiceRunning(): Boolean = isRunning

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
        Log.d(TAG, "✨ onCreate called")

        // Set liveness flag
        isRunning = true

        // Initialize managers
        prefsManager = PreferencesManager(this)
        apiClient = ApiClient(this)
        stateManager = HeartbeatStateManager(this)
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Start polling thread (off main thread)
        pollingThread.start()
        pollingHandler = Handler(pollingThread.looper)

        // Create watchdog handler on main thread
        watchdogHandler = Handler(android.os.Looper.getMainLooper())

        // Create foreground notification
        createNotificationChannel()
        val notification = createNotification("Initializing...")
        startForeground(NOTIFICATION_ID, notification)
        Log.d(TAG, "✅ Started as foreground service")

        // Start polling and watchdog
        startPolling()
        startWatchdog()
    }

    /**
     * Creates notification channel for foreground service.
     * Low importance to avoid disturbing the user.
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "MDM Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Device management heartbeat service"
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Creates ongoing notification with current heartbeat status.
     * setOngoing(true) prevents user from swiping it away.
     */
    private fun createNotification(status: String): Notification {
        // Intent to open MainActivity when notification is tapped
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("BBTec MDM Active")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)  // Can't be dismissed by user
                .setContentIntent(pendingIntent)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("BBTec MDM Active")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .build()
        }
    }

    /**
     * Updates notification with last heartbeat time.
     */
    private fun updateNotification() {
        val lastHeartbeat = prefsManager.getLastHeartbeat()
        val status = if (lastHeartbeat > 0) {
            val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(lastHeartbeat))
            "Last check-in: $time"
        } else {
            "Waiting for first check-in..."
        }

        val notification = createNotification(status)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand called - sending immediate heartbeat")
        // Send immediate heartbeat when app is opened (even if service already running)
        apiClient.sendHeartbeat()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startPolling() {
        Log.d(TAG, "🔄 startPolling called")
        pollingHandler.post(object : Runnable {
            override fun run() {
                try {
                    Log.d(TAG, "📡 Polling cycle started")

                    // Send heartbeat
                    apiClient.sendHeartbeat()

                    // Update notification with latest heartbeat time
                    updateNotification()

                    // Check for commands
                    apiClient.getCommands { commands ->
                    Log.d(TAG, "Got ${commands?.size ?: 0} commands")
                    commands?.forEach { command ->
                        Log.d(TAG, "Processing command: ${command.action} (ID: ${command.commandId})")
                        when (command.action) {
                            "install_apk" -> {
                                command.apkUrl?.let { apkUrl ->
                                    command.packageName?.let { packageName ->
                                        ApkInstaller(this@PollingService)
                                            .installApk(apkUrl, packageName, command.commandId)
                                    }
                                }
                            }
                            "wipe" -> {
                                Log.w(TAG, "═══ WIPE COMMAND RECEIVED (background) ═══")
                                Log.w(TAG, "Reporting 'completed' to backend - waiting for confirmation...")

                                // Report completed and wait for backend confirmation
                                apiClient.reportCommandStatus(command.commandId, "completed", null) { success ->
                                    if (success) {
                                        Log.w(TAG, "✅ Backend confirmed wipe command - EXECUTING FACTORY RESET NOW")
                                        val policyManager = PolicyManager(this@PollingService)
                                        policyManager.wipeDevice()
                                        // Device will wipe immediately after this
                                    } else {
                                        Log.e(TAG, "❌ Backend did not confirm - ABORTING wipe for safety")
                                        Log.e(TAG, "Wipe command will retry on next polling cycle")
                                    }
                                }
                            }
                            "lock" -> {
                                Log.d(TAG, "LOCK command received - locking device")
                                apiClient.reportCommandStatus(command.commandId, "executing", null)
                                val policyManager = PolicyManager(this@PollingService)
                                policyManager.lockDevice()
                                apiClient.reportCommandStatus(command.commandId, "completed", null)
                            }
                            "reboot" -> {
                                Log.d(TAG, "REBOOT command received - rebooting device")
                                apiClient.reportCommandStatus(command.commandId, "executing", null)
                                val policyManager = PolicyManager(this@PollingService)
                                policyManager.rebootDevice()
                                // Device will reboot immediately, no need to report completion
                            }
                            else -> {
                                Log.w(TAG, "Unknown command action: ${command.action}")
                            }
                        }
                    }
                }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Exception in polling cycle - will retry", e)
                    // Don't let exceptions kill the polling loop
                } finally {
                    // ALWAYS schedule next poll, even if exception occurred
                    try {
                        val intervalMs = prefsManager.getPingInterval() * 60 * 1000L
                        Log.d(TAG, "⏰ Scheduling next poll in ${intervalMs / 60000} minutes")
                        pollingHandler.postDelayed(this, intervalMs)
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Fatal: Cannot schedule next poll", e)
                        // Trigger recovery
                        scheduleServiceKick()
                        stopSelf()
                    }
                }
            }
        })
    }

    /**
     * Watchdog monitors heartbeat health and triggers self-restart if needed.
     * Uses monotonic clock (elapsedRealtime) to avoid wall-clock issues.
     * Checks every minute.
     */
    private fun startWatchdog() {
        Log.d(TAG, "🐕 Watchdog started")
        watchdogHandler.postDelayed(object : Runnable {
            override fun run() {
                val now = SystemClock.elapsedRealtime()
                val lastSuccess = stateManager.getLastSuccessAtBlocking()
                val pingIntervalMs = prefsManager.getPingInterval() * 60 * 1000L
                val maxSilenceMs = pingIntervalMs * 2

                // Check if heartbeat is overdue
                if (lastSuccess > 0 && (now - lastSuccess) > maxSilenceMs) {
                    val silenceMinutes = (now - lastSuccess) / 60_000
                    Log.w(TAG, "🚨 Watchdog: No successful heartbeat for ${silenceMinutes}m (threshold: ${maxSilenceMs / 60_000}m)")
                    Log.w(TAG, "🚨 Triggering self-restart via WorkManager kick")

                    // Schedule service restart via WorkManager
                    scheduleServiceKick()

                    // Stop self to allow restart
                    stopSelf()
                    return
                }

                // Log watchdog health check
                val minutesSinceSuccess = if (lastSuccess > 0) (now - lastSuccess) / 60_000 else -1
                Log.d(TAG, "🐕 Watchdog check: OK (last success: ${minutesSinceSuccess}m ago)")

                // Schedule next watchdog check in 1 minute
                watchdogHandler.postDelayed(this, 60_000L)
            }
        }, 60_000L)  // First check after 1 minute
    }

    /**
     * Schedules a one-off WorkManager job to restart the service.
     * Safe for background start restrictions.
     */
    private fun scheduleServiceKick() {
        Log.d(TAG, "📋 Scheduling ServiceKickWorker")
        val kickRequest = OneTimeWorkRequestBuilder<ServiceKickWorker>().build()
        WorkManager.getInstance(this).enqueueUniqueWork(
            "mdm-service-kick",
            ExistingWorkPolicy.REPLACE,
            kickRequest
        )
    }

    override fun onDestroy() {
        Log.w(TAG, "⚠️ onDestroy called - service is being killed")

        // Clear liveness flag
        isRunning = false

        // Schedule WorkManager recovery kick
        scheduleServiceKick()
        Log.d(TAG, "📋 Scheduled recovery kick via WorkManager")

        // Clean up handlers
        pollingHandler.removeCallbacksAndMessages(null)
        watchdogHandler.removeCallbacksAndMessages(null)

        // Stop polling thread
        pollingThread.quitSafely()

        super.onDestroy()
        Log.d(TAG, "💀 Service destroyed")
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.w(TAG, "⚠️ onTaskRemoved - app swiped away")
        // Schedule recovery via WorkManager
        scheduleServiceKick()
        // CRITICAL: Kill self to ensure clean restart
        // ServiceKickWorker will restart us fresh with onCreate()
        Log.w(TAG, "⚠️ Stopping self to allow clean restart")
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }
}
