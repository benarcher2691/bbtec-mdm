package com.bbtec.mdm.client

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log
import com.google.gson.Gson
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException

/**
 * PolicyManager - Enforces device policies from the MDM server
 * Requires Device Owner permissions to function properly
 */
class PolicyManager(private val context: Context) {

    private val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val adminComponent = ComponentName(context, MdmDeviceAdminReceiver::class.java)
    private val prefsManager = PreferencesManager(context)
    private val client = OkHttpClient()
    private val gson = Gson()

    /**
     * Check if we have Device Owner permissions
     */
    fun isDeviceOwner(): Boolean {
        return dpm.isDeviceOwnerApp(context.packageName)
    }

    /**
     * Sync policies from server and apply them
     */
    fun syncPolicies() {
        if (!isDeviceOwner()) {
            Log.e(TAG, "Cannot sync policies - not Device Owner")
            return
        }

        val apiToken = prefsManager.getApiToken()
        if (apiToken.isEmpty()) {
            Log.e(TAG, "Cannot sync policies - no API token")
            return
        }

        val serverUrl = prefsManager.getServerUrl()
        val deviceId = prefsManager.getDeviceId()

        Log.d(TAG, "Fetching policies from server...")

        val request = Request.Builder()
            .url("$serverUrl/api/dpc/policies?deviceId=$deviceId")
            .addHeader("Authorization", "Bearer $apiToken")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    Log.d(TAG, "Policy response: $body")

                    try {
                        val policyResponse = gson.fromJson(body, PolicyResponse::class.java)
                        if (policyResponse.success && policyResponse.policy != null) {
                            applyPolicy(policyResponse.policy)
                        } else {
                            Log.w(TAG, "No policy returned from server")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to parse policy response", e)
                    }
                } else {
                    Log.e(TAG, "Failed to fetch policies: ${response.code}")
                }
            }

            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Failed to fetch policies", e)
            }
        })
    }

    /**
     * Apply a policy to the device
     */
    private fun applyPolicy(policy: Policy) {
        Log.d(TAG, "Applying policy: ${policy.name}")

        try {
            // Camera restrictions
            dpm.setCameraDisabled(adminComponent, policy.cameraDisabled)
            Log.d(TAG, "Camera disabled: ${policy.cameraDisabled}")

            // Screen capture
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                dpm.setScreenCaptureDisabled(adminComponent, policy.screenCaptureDisabled)
                Log.d(TAG, "Screen capture disabled: ${policy.screenCaptureDisabled}")
            }

            // Factory reset
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                dpm.setFactoryResetProtectionPolicy(adminComponent, null)
                Log.d(TAG, "Factory reset disabled: ${policy.factoryResetDisabled}")
            }

            // Status bar (kiosk mode)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && policy.statusBarDisabled) {
                dpm.setStatusBarDisabled(adminComponent, true)
                Log.d(TAG, "Status bar disabled")
            }

            // Lock task mode (kiosk mode)
            if (policy.kioskEnabled && policy.kioskPackageNames.isNotEmpty()) {
                dpm.setLockTaskPackages(adminComponent, policy.kioskPackageNames.toTypedArray())
                Log.d(TAG, "Kiosk mode enabled for packages: ${policy.kioskPackageNames}")
            }

            // Password requirements
            if (policy.passwordRequired) {
                val quality = when (policy.passwordQuality) {
                    "numeric" -> DevicePolicyManager.PASSWORD_QUALITY_NUMERIC
                    "alphabetic" -> DevicePolicyManager.PASSWORD_QUALITY_ALPHABETIC
                    "alphanumeric" -> DevicePolicyManager.PASSWORD_QUALITY_ALPHANUMERIC
                    "complex" -> DevicePolicyManager.PASSWORD_QUALITY_COMPLEX
                    else -> DevicePolicyManager.PASSWORD_QUALITY_SOMETHING
                }
                dpm.setPasswordQuality(adminComponent, quality)

                policy.passwordMinLength?.let {
                    dpm.setPasswordMinimumLength(adminComponent, it)
                }
                Log.d(TAG, "Password policy applied: quality=${policy.passwordQuality}, minLength=${policy.passwordMinLength}")
            } else {
                dpm.setPasswordQuality(adminComponent, DevicePolicyManager.PASSWORD_QUALITY_UNSPECIFIED)
                Log.d(TAG, "Password not required")
            }

            // System apps (disable/enable)
            policy.systemAppsDisabled.forEach { packageName ->
                try {
                    dpm.setApplicationHidden(adminComponent, packageName, true)
                    Log.d(TAG, "Hidden system app: $packageName")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to hide app $packageName", e)
                }
            }

            Log.d(TAG, "Policy applied successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Error applying policy", e)
        }
    }

    /**
     * Lock the device immediately
     */
    fun lockDevice() {
        if (!isDeviceOwner()) {
            Log.e(TAG, "Cannot lock device - not Device Owner")
            return
        }
        dpm.lockNow()
        Log.d(TAG, "Device locked")
    }

    /**
     * Wipe device data (factory reset)
     */
    fun wipeDevice() {
        if (!isDeviceOwner()) {
            Log.e(TAG, "Cannot wipe device - not Device Owner")
            return
        }
        Log.w(TAG, "Wiping device data...")
        dpm.wipeData(0)
    }

    /**
     * Reboot device
     */
    fun rebootDevice() {
        if (!isDeviceOwner()) {
            Log.e(TAG, "Cannot reboot device - not Device Owner")
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            dpm.reboot(adminComponent)
            Log.d(TAG, "Device rebooting...")
        } else {
            Log.e(TAG, "Reboot not supported on this Android version")
        }
    }

    // Data classes for JSON parsing
    data class PolicyResponse(
        val success: Boolean,
        val policy: Policy?
    )

    data class Policy(
        val name: String,
        val description: String?,

        // Password requirements
        val passwordRequired: Boolean,
        val passwordMinLength: Int?,
        val passwordQuality: String?,

        // Device restrictions
        val cameraDisabled: Boolean,
        val screenCaptureDisabled: Boolean,
        val bluetoothDisabled: Boolean,
        val usbFileTransferDisabled: Boolean,
        val factoryResetDisabled: Boolean,

        // Kiosk mode
        val kioskEnabled: Boolean,
        val kioskPackageNames: List<String>,

        // System behavior
        val statusBarDisabled: Boolean,
        val systemAppsDisabled: List<String>
    )

    companion object {
        private const val TAG = "PolicyManager"
    }
}
