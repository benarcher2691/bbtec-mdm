package com.bbtec.mdm.client

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
        val deviceId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )

        Log.d(TAG, "Registering device: $deviceId")

        // Only send device ID - metadata comes from Android Management API
        val json = gson.toJson(mapOf(
            "deviceId" to deviceId
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
                    prefsManager.setDeviceId(deviceId)
                    prefsManager.setRegistered(true)
                    Log.d(TAG, "Registration successful!")
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

    companion object {
        private const val TAG = "DeviceRegistration"
    }
}
