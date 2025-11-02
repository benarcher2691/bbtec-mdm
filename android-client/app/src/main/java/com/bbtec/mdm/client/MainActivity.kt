package com.bbtec.mdm.client

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var prefsManager: PreferencesManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate called")
        setContentView(R.layout.activity_main)

        prefsManager = PreferencesManager(this)

        // Register device on first launch
        val isRegistered = prefsManager.isRegistered()
        Log.d(TAG, "Is registered: $isRegistered")
        if (!isRegistered) {
            Log.d(TAG, "Starting device registration...")
            DeviceRegistration(this).registerDevice()
        }

        // Start polling service
        Log.d(TAG, "Starting polling service...")
        PollingService.startService(this)

        // Update UI
        updateStatus()
    }

    companion object {
        private const val TAG = "MainActivity"
    }

    private fun updateStatus() {
        val statusText = findViewById<TextView>(R.id.statusText)
        val lastHeartbeatText = findViewById<TextView>(R.id.lastHeartbeat)
        val pingIntervalText = findViewById<TextView>(R.id.pingInterval)
        val versionText = findViewById<TextView>(R.id.versionText)

        val lastHeartbeat = prefsManager.getLastHeartbeat()
        val pingInterval = prefsManager.getPingInterval()

        statusText.text = getString(R.string.status_connected)
        lastHeartbeatText.text = getString(R.string.last_checkin, formatTime(lastHeartbeat))
        pingIntervalText.text = getString(R.string.checkin_interval, pingInterval)

        // Get version from package info
        val versionName = try {
            packageManager.getPackageInfo(packageName, 0).versionName
        } catch (e: Exception) {
            "Unknown"
        }
        versionText.text = "Version: $versionName"
    }

    private fun formatTime(timestamp: Long): String {
        if (timestamp == 0L) return getString(R.string.never)
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }
}
