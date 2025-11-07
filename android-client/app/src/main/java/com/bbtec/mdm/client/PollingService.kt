package com.bbtec.mdm.client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

class PollingService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var prefsManager: PreferencesManager
    private lateinit var apiClient: ApiClient

    companion object {
        private const val TAG = "PollingService"

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
        Log.d(TAG, "onCreate called")

        // Start as foreground service on Android 8+ to avoid background restrictions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "mdm_service_channel"
            val channelName = "MDM Service"

            // Create notification channel
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_LOW
            )
            notificationManager.createNotificationChannel(channel)

            // Create notification
            val notification = Notification.Builder(this, channelId)
                .setContentTitle("BBTec MDM")
                .setContentText("Device management active")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build()

            // Start as foreground
            startForeground(1, notification)
            Log.d(TAG, "Started as foreground service")
        }

        prefsManager = PreferencesManager(this)
        apiClient = ApiClient(this)
        startPolling()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand called - sending immediate heartbeat")
        // Send immediate heartbeat when app is opened (even if service already running)
        apiClient.sendHeartbeat()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startPolling() {
        Log.d(TAG, "startPolling called")
        handler.post(object : Runnable {
            override fun run() {
                Log.d(TAG, "Polling cycle started")
                // Send heartbeat
                apiClient.sendHeartbeat()

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

                // Schedule next poll
                val intervalMs = prefsManager.getPingInterval() * 60 * 1000L
                Log.d(TAG, "Scheduling next poll in ${intervalMs / 60000} minutes")
                handler.postDelayed(this, intervalMs)
            }
        })
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
