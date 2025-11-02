package com.bbtec.mdm.client

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class MdmDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        // Device Owner mode enabled
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        // Stop services
        PollingService.stopService(context)
    }
}
