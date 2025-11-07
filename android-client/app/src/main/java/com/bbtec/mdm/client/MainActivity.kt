package com.bbtec.mdm.client

import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var prefsManager: PreferencesManager
    private lateinit var apiClient: ApiClient
    private lateinit var syncButton: Button
    private lateinit var syncStatusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate called")
        setContentView(R.layout.activity_main)

        prefsManager = PreferencesManager(this)
        apiClient = ApiClient(this)

        // Initialize UI elements
        syncButton = findViewById(R.id.syncButton)
        syncStatusText = findViewById(R.id.syncStatusText)

        // Set up sync button
        syncButton.setOnClickListener {
            performSync()
        }

        // Register device on first launch
        val isRegistered = prefsManager.isRegistered()
        Log.d(TAG, "Is registered: $isRegistered")

        if (!isRegistered) {
            // Check if we have enrollment token from QR provisioning
            val enrollmentToken = prefsManager.getEnrollmentToken()

            if (enrollmentToken != null) {
                Log.d(TAG, "Found enrollment token, using DPC registration...")
                DeviceRegistration(this).registerDeviceWithToken(enrollmentToken)
            } else {
                Log.d(TAG, "No enrollment token, using fallback registration...")
                DeviceRegistration(this).registerDevice()
            }
        }

        // Start polling service
        Log.d(TAG, "Starting polling service...")
        PollingService.startService(this)

        // Update UI
        updateStatus()
    }

    private fun performSync() {
        Log.d(TAG, "Manual sync triggered")

        // Disable button during sync
        syncButton.isEnabled = false
        syncStatusText.text = "Syncing..."
        Toast.makeText(this, "Syncing with server...", Toast.LENGTH_SHORT).show()

        // Send heartbeat
        apiClient.sendHeartbeat()

        // Get and process commands
        apiClient.getCommands { commands ->
            runOnUiThread {
                if (commands == null) {
                    syncStatusText.text = "Sync failed - check connection"
                    Toast.makeText(this, "Sync failed", Toast.LENGTH_SHORT).show()
                    syncButton.isEnabled = true
                    return@runOnUiThread
                }

                Log.d(TAG, "Sync: Got ${commands.size} commands")

                // Process commands
                commands.forEach { command ->
                    Log.d(TAG, "Sync: Processing command ${command.action}")
                    when (command.action) {
                        "install_apk" -> {
                            command.apkUrl?.let { apkUrl ->
                                command.packageName?.let { packageName ->
                                    ApkInstaller(this)
                                        .installApk(apkUrl, packageName, command.commandId)
                                }
                            }
                        }
                        "wipe" -> {
                            Log.w(TAG, "WIPE command received via sync - executing factory reset")
                            apiClient.reportCommandStatus(command.commandId, "executing", null)
                            val policyManager = PolicyManager(this)
                            policyManager.wipeDevice()
                            // Device will wipe immediately
                        }
                        "lock" -> {
                            Log.d(TAG, "LOCK command received via sync - locking device")
                            apiClient.reportCommandStatus(command.commandId, "executing", null)
                            val policyManager = PolicyManager(this)
                            policyManager.lockDevice()
                            apiClient.reportCommandStatus(command.commandId, "completed", null)
                        }
                        "reboot" -> {
                            Log.d(TAG, "REBOOT command received via sync - rebooting device")
                            apiClient.reportCommandStatus(command.commandId, "executing", null)
                            val policyManager = PolicyManager(this)
                            policyManager.rebootDevice()
                            // Device will reboot immediately
                        }
                    }
                }

                // Update UI
                val commandText = when {
                    commands.isEmpty() -> "Up to date - no commands"
                    commands.size == 1 -> "Synced - 1 command processed"
                    else -> "Synced - ${commands.size} commands processed"
                }
                syncStatusText.text = "$commandText at ${SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())}"
                Toast.makeText(this, commandText, Toast.LENGTH_SHORT).show()

                // Re-enable button
                syncButton.isEnabled = true

                // Update status display
                updateStatus()
            }
        }
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
