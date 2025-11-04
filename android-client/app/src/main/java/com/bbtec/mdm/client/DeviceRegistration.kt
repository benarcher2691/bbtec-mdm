package com.bbtec.mdm.client

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class DeviceRegistration(private val context: Context) {

    private val client = OkHttpClient()
    private val gson = Gson()
    private val prefsManager = PreferencesManager(context)

    fun registerDevice() {
        // Use serial number as device ID - this matches Android Management API's hardwareInfo.serialNumber
        val deviceId = try {
            Build.getSerial()
        } catch (e: SecurityException) {
            // Fallback to ANDROID_ID if serial number is not accessible
            Log.w(TAG, "Cannot access serial number, falling back to ANDROID_ID", e)
            Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID
            )
        }

        Log.d(TAG, "Registering device with serial: $deviceId")

        val androidId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )

        // Check Device Owner status
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val isDeviceOwner = dpm.isDeviceOwnerApp(context.packageName)

        // Send full device information
        val json = gson.toJson(mapOf(
            "deviceId" to deviceId,
            "serialNumber" to deviceId,
            "androidId" to androidId,
            "model" to Build.MODEL,
            "manufacturer" to Build.MANUFACTURER,
            "androidVersion" to Build.VERSION.RELEASE,
            "isDeviceOwner" to isDeviceOwner
        ))

        val request = Request.Builder()
            .url("https://bbtec-mdm.vercel.app/api/client/register")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        Log.d(TAG, "Sending registration request...")
        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "Registration response: ${response.code}")
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    Log.d(TAG, "Registration response body: $body")

                    // Parse response to get API token
                    val result = gson.fromJson(body, RegistrationResponse::class.java)

                    if (result.success && result.apiToken != null) {
                        prefsManager.setDeviceId(deviceId)
                        prefsManager.setApiToken(result.apiToken)
                        prefsManager.setRegistered(true)
                        Log.d(TAG, "Registration successful! Token saved.")

                        // Send immediate heartbeat now that we have a token
                        Log.d(TAG, "Sending immediate heartbeat after registration...")
                        ApiClient(context).sendHeartbeat()
                    } else {
                        Log.e(TAG, "Registration succeeded but no token in response")
                    }
                } else {
                    Log.e(TAG, "Registration failed: ${response.body?.string()}")
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e(TAG, "Registration failed with exception", e)
                // Retry on next app launch
            }
        })
    }

    /**
     * Register device with enrollment token (Device Owner mode)
     * Uses the new DPC registration endpoint
     */
    fun registerDeviceWithToken(enrollmentToken: String) {
        val serverUrl = prefsManager.getServerUrl()
        Log.d(TAG, "Registering device with enrollment token at: $serverUrl")

        // Get device information
        val serialNumber = try {
            Build.getSerial()
        } catch (e: SecurityException) {
            Log.w(TAG, "Cannot access serial number", e)
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        }

        val androidId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )

        // Check Device Owner status
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(context, MdmDeviceAdminReceiver::class.java)
        val isDeviceOwner = dpm.isDeviceOwnerApp(context.packageName)

        Log.d(TAG, "Device Info - Serial: $serialNumber, Android ID: $androidId")
        Log.d(TAG, "Is Device Owner: $isDeviceOwner")

        // Build registration request
        val requestData = mapOf(
            "enrollmentToken" to enrollmentToken,
            "serialNumber" to serialNumber,
            "androidId" to androidId,
            "model" to Build.MODEL,
            "manufacturer" to Build.MANUFACTURER,
            "androidVersion" to Build.VERSION.RELEASE,
            "isDeviceOwner" to isDeviceOwner
        )

        val json = gson.toJson(requestData)

        val request = Request.Builder()
            .url("$serverUrl/api/dpc/register")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        Log.d(TAG, "Sending DPC registration request...")
        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "DPC registration response: ${response.code}")
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    Log.d(TAG, "DPC registration response body: $body")

                    val result = gson.fromJson(body, RegistrationResponse::class.java)

                    if (result.success && result.apiToken != null) {
                        prefsManager.setDeviceId(serialNumber)
                        prefsManager.setApiToken(result.apiToken)
                        prefsManager.setRegistered(true)
                        Log.d(TAG, "DPC registration successful! Token saved.")

                        // Send immediate heartbeat
                        Log.d(TAG, "Sending immediate heartbeat after DPC registration...")
                        ApiClient(context).sendHeartbeat()
                    } else {
                        Log.e(TAG, "DPC registration succeeded but no token in response")
                    }
                } else {
                    Log.e(TAG, "DPC registration failed: ${response.body?.string()}")
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e(TAG, "DPC registration failed with exception", e)
            }
        })
    }

    data class RegistrationResponse(
        val success: Boolean,
        val apiToken: String?
    )

    companion object {
        private const val TAG = "DeviceRegistration"
    }
}
