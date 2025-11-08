package com.bbtec.mdm.client

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.widget.Button
import android.widget.EditText
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
    private lateinit var pingIntervalInput: EditText
    private lateinit var savePingIntervalButton: Button
    private lateinit var pingIntervalStatusText: TextView
    private lateinit var enrollmentIdText: TextView
    private lateinit var ssaIdText: TextView
    private lateinit var serialNumberText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate called")
        setContentView(R.layout.activity_main)

        prefsManager = PreferencesManager(this)
        apiClient = ApiClient(this)

        // Initialize UI elements
        syncButton = findViewById(R.id.syncButton)
        syncStatusText = findViewById(R.id.syncStatusText)
        pingIntervalInput = findViewById(R.id.pingIntervalInput)
        savePingIntervalButton = findViewById(R.id.savePingIntervalButton)
        pingIntervalStatusText = findViewById(R.id.pingIntervalStatusText)
        enrollmentIdText = findViewById(R.id.enrollmentIdText)
        ssaIdText = findViewById(R.id.ssaIdText)
        serialNumberText = findViewById(R.id.serialNumberText)

        // Set up sync button
        syncButton.setOnClickListener {
            performSync()
        }

        // Set up ping interval controls
        pingIntervalInput.setText(prefsManager.getPingInterval().toString())
        savePingIntervalButton.setOnClickListener {
            savePingInterval()
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

                Log.d(TAG, "═══ SYNC: Got ${commands.size} commands ═══")

                // Process commands
                commands.forEach { command ->
                    Log.d(TAG, "Processing command: action=${command.action}, commandId=${command.commandId}")
                    when (command.action) {
                        "install_apk" -> {
                            Log.d(TAG, "Install APK command - apkUrl=${command.apkUrl}, packageName=${command.packageName}")
                            command.apkUrl?.let { apkUrl ->
                                command.packageName?.let { packageName ->
                                    Log.d(TAG, "Starting ApkInstaller for package: $packageName")
                                    ApkInstaller(this)
                                        .installApk(apkUrl, packageName, command.commandId)
                                }
                            } ?: Log.e(TAG, "❌ Missing apkUrl or packageName in install_apk command!")
                        }
                        "wipe" -> {
                            Log.w(TAG, "═══ WIPE COMMAND RECEIVED ═══")
                            Log.w(TAG, "Reporting 'completed' to backend - waiting for confirmation...")

                            // Report completed and wait for backend confirmation
                            apiClient.reportCommandStatus(command.commandId, "completed", null) { success ->
                                runOnUiThread {
                                    if (success) {
                                        Log.w(TAG, "✅ Backend confirmed wipe command - EXECUTING FACTORY RESET NOW")
                                        val policyManager = PolicyManager(this)
                                        policyManager.wipeDevice()
                                        // Device will wipe immediately after this
                                    } else {
                                        Log.e(TAG, "❌ Backend did not confirm - ABORTING wipe for safety")
                                        Log.e(TAG, "Wipe command will retry on next sync")
                                        Toast.makeText(this, "Wipe failed - backend unreachable. Will retry.", Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
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

    private fun savePingInterval() {
        val inputText = pingIntervalInput.text.toString()

        if (inputText.isEmpty()) {
            Toast.makeText(this, "Please enter a ping interval", Toast.LENGTH_SHORT).show()
            return
        }

        val interval = inputText.toIntOrNull()

        if (interval == null || interval < 1 || interval > 180) {
            Toast.makeText(this, "Ping interval must be between 1 and 180 minutes", Toast.LENGTH_SHORT).show()
            return
        }

        // Disable button during save
        savePingIntervalButton.isEnabled = false
        pingIntervalStatusText.text = "Saving..."
        Toast.makeText(this, "Updating ping interval...", Toast.LENGTH_SHORT).show()

        apiClient.updatePingInterval(interval) { success ->
            runOnUiThread {
                if (success) {
                    pingIntervalStatusText.text = "Saved at ${SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())}"
                    Toast.makeText(this, "Ping interval updated to $interval minutes", Toast.LENGTH_SHORT).show()
                    updateStatus()
                } else {
                    pingIntervalStatusText.text = "Failed to save"
                    Toast.makeText(this, "Failed to update ping interval", Toast.LENGTH_SHORT).show()
                }
                savePingIntervalButton.isEnabled = true
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

        // Update device identifiers
        updateDeviceIdentifiers()
    }

    private fun updateDeviceIdentifiers() {
        // Get DevicePolicyManager for enrollment ID
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

        // Get stable enrollment ID (unique per enrollment, survives app reinstall)
        // NOTE: getEnrollmentSpecificId() only available on Android 12+ (API 31+)
        val enrollmentId = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                dpm.enrollmentSpecificId ?: "Not available (not Device Owner)"
            } else {
                "Not available (Android < 12)"
            }
        } catch (e: Exception) {
            "Error: ${e.message}"
        }

        // Get app-scoped Android ID (SSAID - stable for this app+device+user)
        val ssaId = try {
            Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ANDROID_ID
            ) ?: "Not available"
        } catch (e: Exception) {
            "Error: ${e.message}"
        }

        // Get hardware serial number (NEVER fall back to androidId!)
        val serialNumber = try {
            val serial = Build.getSerial()

            // Validate it's a real serial, not a placeholder or androidId collision
            when {
                serial == ssaId -> {
                    "0 (collision with SSAID)"
                }
                serial == "unknown" || serial.isEmpty() -> {
                    "0 (placeholder: '$serial')"
                }
                serial.matches(Regex("^[0-9a-fA-F]{16}$")) -> {
                    "0 (looks like Android ID)"
                }
                else -> {
                    serial
                }
            }
        } catch (e: SecurityException) {
            "0 (READ_PHONE_STATE denied)"
        } catch (e: Exception) {
            "Error: ${e.message}"
        }

        // Update TextViews
        enrollmentIdText.text = "Enrollment ID: $enrollmentId"
        ssaIdText.text = "SSAID (App Android ID): $ssaId"
        serialNumberText.text = "Serial Number: $serialNumber"

        Log.d(TAG, "═══ DEVICE IDENTIFIERS (UI Display) ═══")
        Log.d(TAG, "Enrollment ID: $enrollmentId")
        Log.d(TAG, "SSAID: $ssaId")
        Log.d(TAG, "Serial Number: $serialNumber")
    }

    private fun formatTime(timestamp: Long): String {
        if (timestamp == 0L) return getString(R.string.never)
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }
}
