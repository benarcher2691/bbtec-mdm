"use client"

import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Smartphone, RefreshCw, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export function DpcClientsList() {
  const devices = useQuery(api.deviceClients.listDevices)

  if (devices === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading devices...</span>
        </div>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-slate-50">
        <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No DPC Clients Enrolled</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Generate a QR code to enroll your first device
        </p>
        <Button asChild>
          <a href="/enrollment/qr-codes">Generate QR Code</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {devices.length} device{devices.length !== 1 ? 's' : ''} enrolled
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Device</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Last Heartbeat</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Mode</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {devices.map((device) => (
              <tr key={device._id} className="hover:bg-slate-50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-100 p-2">
                      <Smartphone className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">{device.manufacturer} {device.model}</div>
                      <div className="text-sm text-muted-foreground">
                        Serial: {device.serialNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Android {device.androidVersion}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    device.status === 'online'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      device.status === 'online' ? 'bg-green-600' : 'bg-gray-600'
                    }`} />
                    {device.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="text-sm">
                    {formatDistanceToNow(new Date(device.lastHeartbeat), { addSuffix: true })}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    device.isDeviceOwner
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {device.isDeviceOwner ? 'Device Owner' : 'Profile Owner'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/management/dpc-clients/${device.deviceId}`}>
                        View
                      </a>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
