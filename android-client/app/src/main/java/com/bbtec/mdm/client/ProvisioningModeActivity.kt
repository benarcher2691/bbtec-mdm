package com.bbtec.mdm.client

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle
import android.util.Log

/**
 * Handles ACTION_GET_PROVISIONING_MODE intent
 * Required for Android 12+ QR code provisioning
 *
 * This activity is called by Android during setup to determine
 * what type of device management to apply.
 */
class ProvisioningModeActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(TAG, "ProvisioningModeActivity started")

        // Get allowed provisioning modes from intent
        val allowedProvisioningModes = intent.getIntegerArrayListExtra(
            DevicePolicyManager.EXTRA_PROVISIONING_ALLOWED_PROVISIONING_MODES
        )

        Log.d(TAG, "Allowed provisioning modes: $allowedProvisioningModes")

        // Default to managed profile (work profile)
        var provisioningMode = DevicePolicyManager.PROVISIONING_MODE_MANAGED_PROFILE

        // Check if fully managed device (Device Owner) is allowed
        if (allowedProvisioningModes?.contains(
                DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE
            ) == true
        ) {
            // Use fully managed device mode (Device Owner)
            provisioningMode = DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE
            Log.d(TAG, "Selected PROVISIONING_MODE_FULLY_MANAGED_DEVICE")
        } else {
            Log.w(TAG, "Fully managed device mode not allowed, using managed profile")
        }

        // Return the selected provisioning mode
        val resultIntent = Intent().apply {
            putExtra(DevicePolicyManager.EXTRA_PROVISIONING_MODE, provisioningMode)
        }

        setResult(RESULT_OK, resultIntent)
        Log.d(TAG, "Provisioning mode set, finishing activity")
        finish()
    }

    companion object {
        private const val TAG = "ProvisioningModeActivity"
    }
}
