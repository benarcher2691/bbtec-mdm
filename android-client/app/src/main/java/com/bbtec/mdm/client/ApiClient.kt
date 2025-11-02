package com.bbtec.mdm.client

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class ApiClient(private val context: Context) {

    private val client = OkHttpClient()
    private val gson = Gson()
    private val prefsManager = PreferencesManager(context)

    // Production server URL
    private val baseUrl = "https://bbtec-mdm.vercel.app/api/client"

    fun sendHeartbeat() {
        val deviceId = prefsManager.getDeviceId()

        val json = gson.toJson(mapOf(
            "deviceId" to deviceId,
            "timestamp" to System.currentTimeMillis()
        ))

        val request = Request.Builder()
            .url("$baseUrl/heartbeat")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    prefsManager.setLastHeartbeat(System.currentTimeMillis())
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e("ApiClient", "Heartbeat failed", e)
            }
        })
    }

    fun getCommands(callback: (List<Command>?) -> Unit) {
        val deviceId = prefsManager.getDeviceId()

        val request = Request.Builder()
            .url("$baseUrl/commands?deviceId=$deviceId")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    val result = gson.fromJson(body, CommandsResponse::class.java)
                    callback(result.commands)
                } else {
                    callback(null)
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e("ApiClient", "Get commands failed", e)
                callback(null)
            }
        })
    }

    fun reportCommandStatus(commandId: String, status: String, error: String?) {
        val json = gson.toJson(mapOf(
            "commandId" to commandId,
            "status" to status,
            "error" to error
        ))

        val request = Request.Builder()
            .url("$baseUrl/command-status")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).execute()
    }

    data class Command(
        val commandId: String,
        val action: String,
        val apkUrl: String,
        val packageName: String
    )

    data class CommandsResponse(
        val commands: List<Command>
    )
}
