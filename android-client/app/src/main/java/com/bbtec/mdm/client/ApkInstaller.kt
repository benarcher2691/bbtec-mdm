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
        Log.d(TAG, "═══ APK INSTALLATION STARTED ═══")
        Log.d(TAG, "Command ID: $commandId")
        Log.d(TAG, "Package: $packageName")
        Log.d(TAG, "Download URL: $downloadUrl")

        Thread {
            try {
                // Download APK
                Log.d(TAG, "Downloading APK from: $downloadUrl")
                val apkFile = downloadApk(downloadUrl)
                Log.d(TAG, "✅ Download complete: ${apkFile.absolutePath}, size: ${apkFile.length()} bytes")

                // Install using PackageInstaller
                Log.d(TAG, "Creating PackageInstaller session...")
                val packageInstaller = context.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(
                    PackageInstaller.SessionParams.MODE_FULL_INSTALL
                )

                val sessionId = packageInstaller.createSession(params)
                Log.d(TAG, "Session created with ID: $sessionId")

                val session = packageInstaller.openSession(sessionId)
                Log.d(TAG, "Session opened, writing APK data...")

                // Write APK to session
                session.openWrite(packageName, 0, -1).use { output ->
                    FileInputStream(apkFile).use { input ->
                        input.copyTo(output)
                    }
                    session.fsync(output)
                }
                Log.d(TAG, "✅ APK data written to session")

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
                Log.d(TAG, "Committing session (starting silent install)...")
                session.commit(pendingIntent.intentSender)
                session.close()
                Log.d(TAG, "✅ Session committed, installation in progress")

                // Clean up
                apkFile.delete()
                Log.d(TAG, "Temporary APK file deleted")

            } catch (e: Exception) {
                Log.e(TAG, "❌ Installation failed for command $commandId", e)
                apiClient.reportCommandStatus(commandId, "failed", e.message)
            }
        }.start()
    }

    companion object {
        private const val TAG = "ApkInstaller"
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

            // Move network call to background thread
            Thread {
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
            }.start()
        }
    }
}
