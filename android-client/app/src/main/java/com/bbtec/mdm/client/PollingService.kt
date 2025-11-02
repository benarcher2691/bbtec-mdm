package com.bbtec.mdm.client

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper

class PollingService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var prefsManager: PreferencesManager
    private lateinit var apiClient: ApiClient

    companion object {
        fun startService(context: Context) {
            context.startService(Intent(context, PollingService::class.java))
        }

        fun stopService(context: Context) {
            context.stopService(Intent(context, PollingService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefsManager = PreferencesManager(this)
        apiClient = ApiClient(this)
        startPolling()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startPolling() {
        handler.post(object : Runnable {
            override fun run() {
                // Send heartbeat
                apiClient.sendHeartbeat()

                // Check for commands
                apiClient.getCommands { commands ->
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
                handler.postDelayed(this, intervalMs)
            }
        })
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
