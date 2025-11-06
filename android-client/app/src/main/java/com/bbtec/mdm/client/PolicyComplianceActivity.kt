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

        try {
            Log.e(TAG, "═══ PolicyComplianceActivity STARTED ═══")
            Log.e(TAG, "Intent: ${intent?.toString()}")
            Log.e(TAG, "Intent action: ${intent?.action}")
            Log.e(TAG, "Intent extras: ${intent?.extras?.keySet()?.joinToString(", ")}")

            // Debug: Log all extras
            intent?.extras?.let { bundle ->
                Log.e(TAG, "All extras in bundle:")
                for (key in bundle.keySet()) {
                    val value = bundle.get(key)
                    Log.e(TAG, "  Key: $key, Value type: ${value?.javaClass?.name}, Value: $value")
                }
            }

            // Retrieve the provisioning admin extras bundle
            Log.e(TAG, "Attempting to retrieve admin extras bundle with key: ${DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE}")
            val adminExtras = try {
                intent.getBundleExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE)
            } catch (e: Exception) {
                Log.e(TAG, "❌ Exception retrieving admin extras: ${e.message}", e)
                null
            }
            Log.e(TAG, "Admin extras result: ${if (adminExtras != null) "NOT NULL" else "NULL"}")

            if (adminExtras != null) {
                val serverUrl = adminExtras.getString("server_url")
                val enrollmentToken = adminExtras.getString("enrollment_token")

                Log.e(TAG, "✅ Admin extras found!")
                Log.e(TAG, "Server URL: $serverUrl")
                Log.e(TAG, "Enrollment token: ${enrollmentToken?.take(8)}...")
                Log.e(TAG, "Admin extras keys: ${adminExtras.keySet()?.joinToString(", ")}")

                // Save to preferences (in case onProfileProvisioningComplete wasn't called yet)
                val prefsManager = PreferencesManager(this)
                if (serverUrl != null) {
                    prefsManager.setServerUrl(serverUrl)
                    Log.e(TAG, "✅ Server URL saved to preferences")
                }
                if (enrollmentToken != null) {
                    prefsManager.setEnrollmentToken(enrollmentToken)
                    Log.e(TAG, "✅ Enrollment token saved to preferences")
                }
            } else {
                Log.e(TAG, "❌ NO admin extras bundle in intent!")
                Log.e(TAG, "This means the QR code did not contain PROVISIONING_ADMIN_EXTRAS_BUNDLE")
            }

            // Perform any initial compliance checks here
            // For now, we just complete successfully
            performPolicyCompliance()
        } catch (e: Exception) {
            Log.e(TAG, "❌❌❌ EXCEPTION in onCreate: ${e.message}", e)
            e.printStackTrace()
            // Still complete compliance to not block provisioning
            completeCompliance()
        }
    }

    private fun performPolicyCompliance() {
        try {
            Log.e(TAG, "═══ performPolicyCompliance STARTED ═══")

            // Check if we achieved Device Owner status
            val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)

            if (isDeviceOwner) {
                Log.e(TAG, "✅✅✅ Device Owner mode confirmed!")
            } else {
                Log.e(TAG, "⚠️⚠️⚠️ Not Device Owner - may be Profile Owner instead")
            }

            // Retrieve saved enrollment token from preferences
            val prefsManager = PreferencesManager(this)
            val enrollmentToken = prefsManager.getEnrollmentToken()
            val serverUrl = prefsManager.getServerUrl()

            Log.e(TAG, "Server URL from prefs: $serverUrl")
            if (enrollmentToken != null) {
                Log.e(TAG, "Enrollment token length: ${enrollmentToken.length}")
                Log.e(TAG, "Enrollment token from prefs: ${if (enrollmentToken.length > 12) enrollmentToken.take(12) + "..." else enrollmentToken}")
            } else {
                Log.e(TAG, "Enrollment token from prefs: NULL")
            }

            if (enrollmentToken != null && serverUrl != null) {
                // Register device with backend
                Log.e(TAG, "🚀 Registering device with enrollment token...")
                DeviceRegistration(this).registerDeviceWithToken(enrollmentToken)

                // Start polling service
                Log.e(TAG, "🚀 Starting polling service...")
                PollingService.startService(this)

                // Apply initial policies
                Log.e(TAG, "🚀 Syncing policies...")
                PolicyManager(this).syncPolicies()

                Log.e(TAG, "✅✅✅ Device registration and policy sync complete")
            } else {
                Log.e(TAG, "❌❌❌ No enrollment token or server URL - skipping registration")
                Log.e(TAG, "This means the QR code did not include the enrollment token!")
            }

            // Complete the compliance flow
            completeCompliance()
        } catch (e: Exception) {
            Log.e(TAG, "❌❌❌ EXCEPTION in performPolicyCompliance: ${e.message}", e)
            e.printStackTrace()
            // Still complete compliance to not block provisioning
            completeCompliance()
        }
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
