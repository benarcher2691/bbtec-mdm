package com.bbtec.mdm.client

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log
import java.io.File
import java.io.FileInputStream

class ApkInstaller(private val context: Context) {

    private val apiClient = ApiClient(context)

    fun installApk(downloadUrl: String, packageName: String, commandId: String) {
        Thread {
            try {
                // Download APK
                val apkFile = downloadApk(downloadUrl)

                // Install using PackageInstaller
                val packageInstaller = context.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(
                    PackageInstaller.SessionParams.MODE_FULL_INSTALL
                )

                val sessionId = packageInstaller.createSession(params)
                val session = packageInstaller.openSession(sessionId)

                // Write APK to session
                session.openWrite(packageName, 0, -1).use { output ->
                    FileInputStream(apkFile).use { input ->
                        input.copyTo(output)
                    }
                    session.fsync(output)
                }

                // Create intent for installation result
                val intent = Intent(context, InstallReceiver::class.java).apply {
                    putExtra("commandId", commandId)
                }
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    sessionId,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                )

                // Commit session (this triggers installation)
                session.commit(pendingIntent.intentSender)
                session.close()

                // Clean up
                apkFile.delete()

            } catch (e: Exception) {
                Log.e("ApkInstaller", "Installation failed", e)
                apiClient.reportCommandStatus(commandId, "failed", e.message)
            }
        }.start()
    }

    private fun downloadApk(url: String): File {
        // Download APK to cache directory
        val apkFile = File(context.cacheDir, "temp_${System.currentTimeMillis()}.apk")

        okhttp3.OkHttpClient().newCall(
            okhttp3.Request.Builder().url(url).build()
        ).execute().use { response ->
            if (!response.isSuccessful) throw Exception("Download failed: ${response.code}")

            response.body?.byteStream()?.use { input ->
                apkFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        }

        return apkFile
    }

    class InstallReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val commandId = intent.getStringExtra("commandId") ?: return
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)

            val apiClient = ApiClient(context)
            when (status) {
                PackageInstaller.STATUS_SUCCESS -> {
                    apiClient.reportCommandStatus(commandId, "completed", null)
                }
                else -> {
                    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                    apiClient.reportCommandStatus(commandId, "failed", message)
                }
            }
        }
    }
}
