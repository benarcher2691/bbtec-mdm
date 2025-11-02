package com.bbtec.mdm.client

import android.app.Service
import android.content.Context
import android.content.Intent
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
            context.startService(Intent(context, PollingService::class.java))
        }

        fun stopService(context: Context) {
            Log.d(TAG, "stopService called")
            context.stopService(Intent(context, PollingService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate called")
        prefsManager = PreferencesManager(this)
        apiClient = ApiClient(this)
        startPolling()
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
                        when (command.action) {
                            "install_apk" -> {
                                ApkInstaller(this@PollingService)
                                    .installApk(command.apkUrl, command.packageName, command.commandId)
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
