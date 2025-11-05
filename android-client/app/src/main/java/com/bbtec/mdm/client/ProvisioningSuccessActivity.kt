package com.bbtec.mdm.client

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log

/**
 * Handles ACTION_PROVISIONING_SUCCESSFUL intent
 * Required for Android to recognize Device Owner capability
 *
 * This activity is called after QR code provisioning completes successfully.
 * Its presence in the manifest signals to Android (especially Android 10)
 * that this app is capable of Device Owner mode.
 */
class ProvisioningSuccessActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(TAG, "Provisioning successful! Processing completion...")

        // Check if we achieved Device Owner status
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)

        if (isDeviceOwner) {
            Log.d(TAG, "✅ Device Owner mode confirmed!")
        } else {
            Log.w(TAG, "⚠️ Not Device Owner - may be Profile Owner instead")
        }

        // Launch MainActivity to show device management UI
        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        Log.d(TAG, "Launching MainActivity...")
        startActivity(mainIntent)

        // Finish this activity
        finish()
    }

    companion object {
        private const val TAG = "ProvisioningSuccess"
    }
}
