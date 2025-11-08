package com.bbtec.mdm.client

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Handles ACTION_PROVISIONING_SUCCESSFUL intent
 *
 * CRITICAL: On Android 8.0+ (API 26+), ALL provisioning work must be done here,
 * not in DeviceAdminReceiver.onProfileProvisioningComplete().
 *
 * This is the key difference between Device Owner and Profile Owner provisioning.
 * TestDPC does all work here on Android 8.0+ and achieves Device Owner status.
 */
class ProvisioningSuccessActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(TAG, "Provisioning successful! Android ${Build.VERSION.SDK_INT} (API ${Build.VERSION.SDK_INT})")

        // Check if we achieved Device Owner status
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)

        if (isDeviceOwner) {
            Log.d(TAG, "✅ Device Owner mode confirmed!")

            // READ_PHONE_STATE permission will be granted automatically by SerialNumberHelper
            // when DeviceRegistration.registerDeviceWithToken() calls SerialNumberHelper.readSerialSafely()
            // This uses proper permission state polling with exponential backoff (up to 5 seconds)
            Log.d(TAG, "READ_PHONE_STATE permission will be granted during registration")
        } else {
            Log.w(TAG, "⚠️ Not Device Owner - may be Profile Owner instead")
        }

        // Extract provisioning admin extras from intent
        // On Android 8.0+, this is where we MUST extract and process the bundle
        val adminExtras = intent.getBundleExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE)

        if (adminExtras != null) {
            val serverUrl = adminExtras.getString("server_url")
            val enrollmentToken = adminExtras.getString("enrollment_token")

            Log.d(TAG, "Server URL: $serverUrl")
            Log.d(TAG, "Enrollment Token: ${enrollmentToken?.take(8)}...")

            if (serverUrl != null && enrollmentToken != null) {
                // Save provisioning data
                val prefsManager = PreferencesManager(this)
                prefsManager.setServerUrl(serverUrl)
                prefsManager.setEnrollmentToken(enrollmentToken)

                // Register device with enrollment token
                Log.d(TAG, "Starting device registration with enrollment token...")
                DeviceRegistration(this).registerDeviceWithToken(enrollmentToken)

                // Start polling service
                PollingService.startService(this)

                // Initialize policy manager and apply initial policies
                PolicyManager(this).syncPolicies()

                Log.d(TAG, "✅ Provisioning complete - device registered and policies synced")
            } else {
                Log.e(TAG, "Missing provisioning data! serverUrl=$serverUrl, token=$enrollmentToken")
            }
        } else {
            // TEST BUILD: No admin extras in QR code
            // This tests if admin extras bundle prevents Device Owner mode on Android 10
            Log.w(TAG, "⚠️ TEST MODE: No EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE in intent!")
            Log.w(TAG, "⚠️ Using hardcoded values for testing Device Owner status")

            // Use hardcoded server URL for testing
            val testServerUrl = "https://bbtec-mdm.vercel.app"

            // Save test server URL
            val prefsManager = PreferencesManager(this)
            prefsManager.setServerUrl(testServerUrl)

            // Skip device registration (no enrollment token available)
            // The goal is to test if we can achieve Device Owner mode
            Log.w(TAG, "⚠️ Skipping device registration (test mode)")

            // Start polling service anyway (will fail gracefully without token)
            PollingService.startService(this)

            Log.d(TAG, "✅ Test provisioning complete - CHECK DEVICE OWNER STATUS")
        }

        // Schedule WorkManager periodic health check
        schedulePeriodicHealthCheck()

        // Request battery optimization exemption
        requestBatteryOptimization()

        // Launch MainActivity to show device management UI
        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        Log.d(TAG, "Launching MainActivity...")
        startActivity(mainIntent)

        // Finish this activity
        finish()
    }

    /**
     * Schedules periodic WorkManager health check.
     *
     * This is the backstop that ensures PollingService stays running.
     * - Period: 15 minutes (minimum for periodic work)
     * - Flex window: 10 minutes (battery efficiency)
     */
    private fun schedulePeriodicHealthCheck() {
        Log.d(TAG, "📅 Scheduling WorkManager periodic health check")

        val healthCheckRequest = PeriodicWorkRequestBuilder<HeartbeatHealthWorker>(
            repeatInterval = 15,
            repeatIntervalTimeUnit = TimeUnit.MINUTES,
            flexTimeInterval = 10,
            flexTimeIntervalUnit = TimeUnit.MINUTES
        ).build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "mdm-heartbeat-health-check",
            ExistingPeriodicWorkPolicy.KEEP,
            healthCheckRequest
        )

        Log.d(TAG, "✅ WorkManager health check scheduled")
    }

    /**
     * Requests battery optimization exemption.
     *
     * Critical for MDM apps to maintain persistent background service.
     * User will see system dialog asking to allow unrestricted battery usage.
     */
    private fun requestBatteryOptimization() {
        val batteryHelper = BatteryOptimizationHelper(this)

        if (!batteryHelper.isIgnoringBatteryOptimizations()) {
            Log.d(TAG, "🔋 Requesting battery optimization exemption")
            batteryHelper.requestBatteryOptimizationExemption(this)
        } else {
            Log.d(TAG, "✅ Already exempt from battery optimization")
        }
    }

    companion object {
        private const val TAG = "ProvisioningSuccess"
    }
}
