package com.bbtec.mdm.client

import android.content.Context
import android.os.Build
import android.provider.Settings
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

        // Only send device ID - metadata comes from Android Management API
        val json = gson.toJson(mapOf(
            "deviceId" to deviceId
        ))

        val request = Request.Builder()
            .url("https://bbtec-mdm.vercel.app/api/client/register")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    prefsManager.setDeviceId(deviceId)
                    prefsManager.setRegistered(true)
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                // Retry on next app launch
            }
        })
    }
}
