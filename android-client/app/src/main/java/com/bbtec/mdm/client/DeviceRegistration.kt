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
        Log.e(TAG, "═══ registerDeviceWithToken CALLED ═══")
        Log.e(TAG, "Server URL: $serverUrl")
        Log.e(TAG, "Enrollment token length: ${enrollmentToken.length}")
        Log.e(TAG, "Enrollment token: ${if (enrollmentToken.length > 12) enrollmentToken.take(12) + "..." else enrollmentToken}")

        // Check Device Owner status first
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(context, MdmDeviceAdminReceiver::class.java)
        val isDeviceOwner = dpm.isDeviceOwnerApp(context.packageName)

        // Get stable enrollment ID (unique per enrollment, survives app reinstall)
        // NOTE: getEnrollmentSpecificId() only available on Android 12+ (API 31+)
        val enrollmentId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            dpm.enrollmentSpecificId
        } else {
            // Android 10/11: Fall back to SSAID (scoped ANDROID_ID)
            Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID
            )
        }
        Log.e(TAG, "Enrollment ID: $enrollmentId (API ${Build.VERSION.SDK_INT})")

        // Get app-scoped Android ID (SSAID - stable for this app+device+user)
        // This is what the app sees - different from base Android ID shown by adb!
        val ssaId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )
        Log.e(TAG, "SSAID (app-scoped Android ID): $ssaId")

        // Get hardware serial number using centralized helper
        // Helper handles permission grant, polling, and validation
        val serialNumber = SerialNumberHelper.readSerialSafely(context) ?: "0"

        Log.e(TAG, "═══ DEVICE IDENTIFIERS ═══")
        Log.e(TAG, "Enrollment ID: $enrollmentId")
        Log.e(TAG, "SSAID: $ssaId")
        Log.e(TAG, "Serial Number: $serialNumber")
        Log.e(TAG, "Is Device Owner: $isDeviceOwner")
        Log.e(TAG, "Model: ${Build.MODEL}")
        Log.e(TAG, "Manufacturer: ${Build.MANUFACTURER}")
        Log.e(TAG, "Android version: ${Build.VERSION.RELEASE}")
        Log.e(TAG, "Build fingerprint: ${Build.FINGERPRINT}")

        // Build registration request - send ALL THREE IDs separately (NEVER mix them!)
        val requestData = mapOf(
            "enrollmentToken" to enrollmentToken,
            "enrollmentId" to enrollmentId,     // Primary key for enrollment
            "ssaId" to ssaId,                   // For device matching across enrollments
            "serialNumber" to serialNumber,     // Hardware serial or "0" sentinel
            "androidId" to ssaId,               // Legacy field for UI backward compatibility (same as ssaId)
            "model" to Build.MODEL,
            "manufacturer" to Build.MANUFACTURER,
            "brand" to Build.BRAND,
            "androidVersion" to Build.VERSION.RELEASE,
            "buildFingerprint" to Build.FINGERPRINT,
            "isDeviceOwner" to isDeviceOwner
        )

        val json = gson.toJson(requestData)
        Log.e(TAG, "Request JSON: $json")

        val request = Request.Builder()
            .url("$serverUrl/api/dpc/register")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        Log.e(TAG, "Sending DPC registration request to: $serverUrl/api/dpc/register")
        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                Log.e(TAG, "═══ DPC REGISTRATION RESPONSE RECEIVED ═══")
                Log.e(TAG, "Response code: ${response.code}")
                Log.e(TAG, "Response successful: ${response.isSuccessful}")

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    Log.e(TAG, "Response body: $body")

                    val result = try {
                        gson.fromJson(body, RegistrationResponse::class.java)
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Failed to parse response JSON: ${e.message}", e)
                        null
                    }

                    if (result?.success == true && result.apiToken != null) {
                        Log.e(TAG, "✅ API token received from backend!")
                        Log.e(TAG, "API token length: ${result.apiToken.length}")
                        Log.e(TAG, "API token: ${if (result.apiToken.length > 12) result.apiToken.take(12) + "..." else result.apiToken}")

                        // Store enrollmentId as primary device identifier (not serialNumber!)
                        prefsManager.setDeviceId(enrollmentId)
                        prefsManager.setApiToken(result.apiToken)
                        prefsManager.setRegistered(true)
                        Log.e(TAG, "✅ Enrollment ID and API token saved to preferences!")
                        Log.e(TAG, "✅ Registration flag set to true!")

                        // Send immediate heartbeat
                        Log.e(TAG, "🚀 Sending immediate heartbeat after DPC registration...")
                        ApiClient(context).sendHeartbeat()
                    } else {
                        Log.e(TAG, "❌ DPC registration response missing success or apiToken!")
                        Log.e(TAG, "result.success: ${result?.success}")
                        Log.e(TAG, "result.apiToken: ${result?.apiToken}")
                    }
                } else {
                    val errorBody = response.body?.string()
                    Log.e(TAG, "❌ DPC registration failed with status ${response.code}")
                    Log.e(TAG, "Error body: $errorBody")
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e(TAG, "❌❌❌ DPC registration network failure!", e)
                Log.e(TAG, "Exception: ${e.message}")
                e.printStackTrace()
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
