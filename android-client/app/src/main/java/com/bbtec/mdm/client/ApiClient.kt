package com.bbtec.mdm.client

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

class ApiClient(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)  // TCP connection timeout
        .writeTimeout(10, TimeUnit.SECONDS)    // Request send timeout
        .readTimeout(10, TimeUnit.SECONDS)     // Response read timeout
        .build()
    private val gson = Gson()
    private val prefsManager = PreferencesManager(context)

    // Production server URL
    private val baseUrl = "https://bbtec-mdm.vercel.app/api/client"

    fun sendHeartbeat() {
        val deviceId = prefsManager.getDeviceId()
        val apiToken = prefsManager.getApiToken()

        if (apiToken.isEmpty()) {
            Log.e("ApiClient", "Cannot send heartbeat: No API token")
            return
        }

        val json = gson.toJson(mapOf(
            "deviceId" to deviceId,
            "timestamp" to System.currentTimeMillis()
        ))

        val request = Request.Builder()
            .url("$baseUrl/heartbeat")
            .header("Authorization", "Bearer $apiToken")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    prefsManager.setLastHeartbeat(System.currentTimeMillis())

                    // Parse response to get updated ping interval
                    val body = response.body?.string()
                    val result = gson.fromJson(body, HeartbeatResponse::class.java)
                    result.pingInterval?.let { interval ->
                        prefsManager.setPingInterval(interval)
                        Log.d("ApiClient", "Updated ping interval to $interval minutes")
                    }
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e("ApiClient", "Heartbeat failed", e)
            }
        })
    }

    fun getCommands(callback: (List<Command>?) -> Unit) {
        val apiToken = prefsManager.getApiToken()

        if (apiToken.isEmpty()) {
            Log.e("ApiClient", "Cannot get commands: No API token")
            callback(null)
            return
        }

        val request = Request.Builder()
            .url("$baseUrl/commands")
            .header("Authorization", "Bearer $apiToken")
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

    fun reportCommandStatus(
        commandId: String,
        status: String,
        error: String?,
        callback: ((Boolean) -> Unit)? = null
    ) {
        val apiToken = prefsManager.getApiToken()

        if (apiToken.isEmpty()) {
            Log.e(TAG, "Cannot report command status: No API token")
            callback?.invoke(false)
            return
        }

        Log.d(TAG, "═══ REPORTING COMMAND STATUS ═══")
        Log.d(TAG, "Command ID: $commandId")
        Log.d(TAG, "Status: $status")
        Log.d(TAG, "Error: ${error ?: "none"}")

        val json = gson.toJson(mapOf(
            "commandId" to commandId,
            "status" to status,
            "error" to error
        ))

        val request = Request.Builder()
            .url("$baseUrl/command-status")
            .header("Authorization", "Bearer $apiToken")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    Log.d(TAG, "✅ Status report successful: HTTP ${response.code}")
                    callback?.invoke(true)
                } else {
                    Log.e(TAG, "❌ Server rejected status report: HTTP ${response.code}")
                    Log.e(TAG, "Response body: ${response.body?.string()}")
                    callback?.invoke(false)
                }
            }

            override fun onFailure(call: Call, e: IOException) {
                when (e) {
                    is SocketTimeoutException ->
                        Log.e(TAG, "❌ Timeout after 10s - network too slow or unreachable")
                    is UnknownHostException ->
                        Log.e(TAG, "❌ DNS failure - cannot resolve server hostname")
                    is ConnectException ->
                        Log.e(TAG, "❌ Connection refused - server not reachable")
                    else ->
                        Log.e(TAG, "❌ Network error: ${e.message}", e)
                }
                callback?.invoke(false)
            }
        })
    }

    companion object {
        private const val TAG = "ApiClient"
    }

    fun updatePingInterval(pingInterval: Int, callback: (Boolean) -> Unit) {
        val apiToken = prefsManager.getApiToken()

        if (apiToken.isEmpty()) {
            Log.e("ApiClient", "Cannot update ping interval: No API token")
            callback(false)
            return
        }

        if (pingInterval < 1 || pingInterval > 180) {
            Log.e("ApiClient", "Invalid ping interval: $pingInterval (must be 1-180)")
            callback(false)
            return
        }

        val json = gson.toJson(mapOf("pingInterval" to pingInterval))

        val request = Request.Builder()
            .url("$baseUrl/ping-interval")
            .header("Authorization", "Bearer $apiToken")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    prefsManager.setPingInterval(pingInterval)
                    Log.d("ApiClient", "Ping interval updated to $pingInterval minutes")
                    callback(true)
                } else {
                    Log.e("ApiClient", "Failed to update ping interval: ${response.code}")
                    callback(false)
                }
            }

            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e("ApiClient", "Update ping interval failed", e)
                callback(false)
            }
        })
    }

    data class Command(
        val commandId: String,
        val action: String,
        val apkUrl: String? = null,
        val packageName: String? = null,
        val parameters: Map<String, Any>? = null
    )

    data class CommandsResponse(
        val commands: List<Command>
    )

    data class HeartbeatResponse(
        val success: Boolean,
        val pingInterval: Int?
    )
}
