package com.bbtec.mdm.client

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Log

/**
 * Handles ACTION_GET_PROVISIONING_MODE intent
 *
 * This activity is called by Android during setup to determine
 * what type of device management to apply.
 *
 * We always return PROVISIONING_MODE_FULLY_MANAGED_DEVICE (1)
 * to request Device Owner mode.
 */
class ProvisioningModeActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(TAG, "ProvisioningModeActivity started")

        // Get allowed provisioning modes from intent (for logging)
        val allowedModes = intent?.getStringArrayListExtra(
            "android.app.extra.PROVISIONING_ALLOWED_PROVISIONING_MODES"
        ) ?: arrayListOf()

        Log.d(TAG, "Allowed provisioning modes: $allowedModes")

        // 1 == DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE
        val wantFullyManaged = 1

        // Return fully managed device mode (Device Owner)
        val resultIntent = Intent().apply {
            putExtra("android.app.extra.PROVISIONING_MODE", wantFullyManaged)
            // Optionally skip Google education screens if you show your own
            // putExtra("android.app.extra.PROVISIONING_SKIP_EDUCATION_SCREENS", true)
        }

        setResult(RESULT_OK, resultIntent)
        Log.d(TAG, "Selected PROVISIONING_MODE_FULLY_MANAGED_DEVICE (1), finishing activity")
        finish()
    }

    companion object {
        private const val TAG = "ProvisioningModeActivity"
    }
}
