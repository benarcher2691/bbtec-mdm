package com.bbtec.mdm.client

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class MdmDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Device admin enabled")

        // Check if we are Device Owner
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val isDeviceOwner = dpm.isDeviceOwnerApp(context.packageName)
        Log.d(TAG, "Is Device Owner: $isDeviceOwner")

        if (!isDeviceOwner) {
            Log.w(TAG, "Not Device Owner - limited functionality")
        }
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)

        // CRITICAL: On Android 8.0+ (API 26+), skip this callback
        // All provisioning work is done in ProvisioningSuccessActivity instead
        // This matches TestDPC behavior and is required for Device Owner mode
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Log.d(TAG, "Android ${Build.VERSION.SDK_INT} - skipping onProfileProvisioningComplete (handled by ProvisioningSuccessActivity)")
            return
        }

        // Legacy path for Android < 8.0 (should never execute on Android 10)
        Log.d(TAG, "Provisioning complete (legacy path)")

        // Extract provisioning extras from intent
        val adminExtras = intent.getBundleExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE)

        if (adminExtras != null) {
            val serverUrl = adminExtras.getString("server_url")
            val enrollmentToken = adminExtras.getString("enrollment_token")

            Log.d(TAG, "Server URL: $serverUrl")
            Log.d(TAG, "Enrollment Token: ${enrollmentToken?.take(8)}...")

            if (serverUrl != null && enrollmentToken != null) {
                // Save provisioning data
                val prefsManager = PreferencesManager(context)
                prefsManager.setServerUrl(serverUrl)
                prefsManager.setEnrollmentToken(enrollmentToken)

                // Register device with enrollment token
                Log.d(TAG, "Starting device registration with enrollment token...")
                DeviceRegistration(context).registerDeviceWithToken(enrollmentToken)

                // Start polling service
                PollingService.startService(context)

                // Initialize policy manager and apply initial policies
                PolicyManager(context).syncPolicies()
            } else {
                Log.e(TAG, "Missing provisioning data! serverUrl=$serverUrl, token=$enrollmentToken")
            }
        } else {
            // TEST BUILD: No admin extras in QR code (legacy path)
            Log.w(TAG, "⚠️ TEST MODE: No admin extras (legacy path)")

            val testServerUrl = "https://bbtec-mdm.vercel.app"
            val prefsManager = PreferencesManager(context)
            prefsManager.setServerUrl(testServerUrl)

            Log.w(TAG, "⚠️ Skipping device registration (test mode - legacy path)")
            PollingService.startService(context)
        }
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.d(TAG, "Device admin disabled")
        // Stop services
        PollingService.stopService(context)
    }

    companion object {
        private const val TAG = "MdmDeviceAdminReceiver"
    }
}
