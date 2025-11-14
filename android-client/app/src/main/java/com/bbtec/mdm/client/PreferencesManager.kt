package com.bbtec.mdm.client

import android.content.Context

class PreferencesManager(context: Context) {

    private val prefs = context.getSharedPreferences("mdm_prefs", Context.MODE_PRIVATE)

    fun isRegistered(): Boolean = prefs.getBoolean("registered", false)
    fun setRegistered(registered: Boolean) = prefs.edit().putBoolean("registered", registered).apply()

    fun getDeviceId(): String = prefs.getString("device_id", "") ?: ""
    fun setDeviceId(id: String) = prefs.edit().putString("device_id", id).apply()

    fun getLastHeartbeat(): Long = prefs.getLong("last_heartbeat", 0)
    fun setLastHeartbeat(timestamp: Long) = prefs.edit().putLong("last_heartbeat", timestamp).apply()

    fun getPingInterval(): Int = prefs.getInt("ping_interval", 5) // Default 5 minutes
    fun setPingInterval(minutes: Int) = prefs.edit().putInt("ping_interval", minutes).apply()

    fun getApiToken(): String = prefs.getString("api_token", "") ?: ""
    fun setApiToken(token: String) = prefs.edit().putString("api_token", token).apply()

    fun getServerUrl(): String = prefs.getString("server_url", "https://bbtec-mdm.vercel.app") ?: "https://bbtec-mdm.vercel.app"
    fun setServerUrl(url: String) = prefs.edit().putString("server_url", url).apply()

    fun getEnrollmentToken(): String = prefs.getString("enrollment_token", "") ?: ""
    fun setEnrollmentToken(token: String) = prefs.edit().putString("enrollment_token", token).apply()
}
