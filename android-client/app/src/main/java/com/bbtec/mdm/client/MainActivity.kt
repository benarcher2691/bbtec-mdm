package com.bbtec.mdm.client

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var prefsManager: PreferencesManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefsManager = PreferencesManager(this)

        // Register device on first launch
        if (!prefsManager.isRegistered()) {
            DeviceRegistration(this).registerDevice()
        }

        // Start polling service
        PollingService.startService(this)

        // Update UI
        updateStatus()
    }

    private fun updateStatus() {
        val statusText = findViewById<TextView>(R.id.statusText)
        val lastHeartbeatText = findViewById<TextView>(R.id.lastHeartbeat)
        val pingIntervalText = findViewById<TextView>(R.id.pingInterval)

        val lastHeartbeat = prefsManager.getLastHeartbeat()
        val pingInterval = prefsManager.getPingInterval()

        statusText.text = getString(R.string.status_connected)
        lastHeartbeatText.text = getString(R.string.last_checkin, formatTime(lastHeartbeat))
        pingIntervalText.text = getString(R.string.checkin_interval, pingInterval)
    }

    private fun formatTime(timestamp: Long): String {
        if (timestamp == 0L) return getString(R.string.never)
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }
}
