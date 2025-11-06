package com.bbtec.mdm.client

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle
import android.util.Log

/**
 * Handles ACTION_ADMIN_POLICY_COMPLIANCE intent
 * Required for Android 12+ QR code provisioning
 *
 * This activity is called after provisioning completes to allow
 * the DPC to perform initial policy compliance setup.
 */
class PolicyComplianceActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(TAG, "PolicyComplianceActivity started")

        // Retrieve the provisioning admin extras bundle
        val adminExtras = intent.getBundleExtra(
            DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
        )

        if (adminExtras != null) {
            val serverUrl = adminExtras.getString("server_url")
            val enrollmentToken = adminExtras.getString("enrollment_token")

            Log.d(TAG, "Admin extras received - Server URL: $serverUrl")
            Log.d(TAG, "Enrollment token: ${enrollmentToken?.take(8)}...")

            // Save to preferences (in case onProfileProvisioningComplete wasn't called yet)
            val prefsManager = PreferencesManager(this)
            if (serverUrl != null) {
                prefsManager.setServerUrl(serverUrl)
            }
            if (enrollmentToken != null) {
                prefsManager.setEnrollmentToken(enrollmentToken)
            }
        } else {
            Log.w(TAG, "No admin extras bundle provided")
        }

        // Perform any initial compliance checks here
        // For now, we just complete successfully
        performPolicyCompliance()
    }

    private fun performPolicyCompliance() {
        Log.d(TAG, "Performing initial policy compliance...")

        // Check if we achieved Device Owner status
        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)

        if (isDeviceOwner) {
            Log.d(TAG, "✅ Device Owner mode confirmed!")
        } else {
            Log.w(TAG, "⚠️ Not Device Owner - may be Profile Owner instead")
        }

        // Retrieve saved enrollment token from preferences
        val prefsManager = PreferencesManager(this)
        val enrollmentToken = prefsManager.getEnrollmentToken()
        val serverUrl = prefsManager.getServerUrl()

        Log.d(TAG, "Server URL: $serverUrl")
        Log.d(TAG, "Enrollment token available: ${enrollmentToken != null}")

        if (enrollmentToken != null && serverUrl != null) {
            // Register device with backend
            Log.d(TAG, "Registering device with enrollment token...")
            DeviceRegistration(this).registerDeviceWithToken(enrollmentToken)

            // Start polling service
            Log.d(TAG, "Starting polling service...")
            PollingService.startService(this)

            // Apply initial policies
            Log.d(TAG, "Syncing policies...")
            PolicyManager(this).syncPolicies()

            Log.d(TAG, "✅ Device registration and policy sync complete")
        } else {
            Log.w(TAG, "⚠️ No enrollment token or server URL - skipping registration")
        }

        // Complete the compliance flow
        completeCompliance()
    }

    private fun completeCompliance() {
        Log.d(TAG, "Policy compliance complete, finishing activity")

        // Must return RESULT_OK to indicate success
        setResult(RESULT_OK, Intent())
        finish()
    }

    companion object {
        private const val TAG = "PolicyComplianceActivity"
    }
}
