"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { listDevices } from "@/app/actions/android-management"
import { Smartphone, RefreshCw, AlertCircle } from "lucide-react"

interface Device {
  name?: string
  enrollmentTime?: string
  lastStatusReportTime?: string
  appliedState?: string
  state?: string
  hardwareInfo?: {
    model?: string
    manufacturer?: string
    serialNumber?: string
    brand?: string
  }
  softwareInfo?: {
    androidVersion?: string
    androidBuildNumber?: string
  }
  policyCompliant?: boolean
  memoryInfo?: {
    totalRam?: string
    totalInternalStorage?: string
  }
}

export function DeviceListTable() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDevices = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await listDevices()

      if (result.success) {
        setDevices(result.devices)
      } else {
        setError(result.error || 'Failed to load devices')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  const getDeviceId = (deviceName: string) => {
    // Extract device ID from full name (enterprises/xxx/devices/yyy)
    const parts = deviceName.split('/')
    return parts[parts.length - 1]
  }

  const formatDate = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleDateString()
  }

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-50'
      case 'PROVISIONING':
        return 'text-blue-600 bg-blue-50'
      case 'DISABLED':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-sm text-muted-foreground">Loading devices...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error Loading Devices</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <Button
              onClick={loadDevices}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-slate-100 p-4">
            <Smartphone className="h-8 w-8 text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">No Devices Enrolled</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Generate a QR code to enroll your first device
            </p>
          </div>
          <Button onClick={loadDevices} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {devices.length} {devices.length === 1 ? 'device' : 'devices'} enrolled
        </p>
        <Button onClick={loadDevices} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Device Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-sm">Device</th>
                <th className="text-left p-4 font-medium text-sm">Model</th>
                <th className="text-left p-4 font-medium text-sm">Android Version</th>
                <th className="text-left p-4 font-medium text-sm">Status</th>
                <th className="text-left p-4 font-medium text-sm">Enrolled</th>
                <th className="text-left p-4 font-medium text-sm">Last Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {devices.map((device) => (
                <tr
                  key={device.name}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-100 p-2">
                        <Smartphone className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {device.hardwareInfo?.model || 'Unknown Model'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {device.name ? getDeviceId(device.name) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-sm">
                      {device.hardwareInfo?.manufacturer || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {device.hardwareInfo?.brand || 'N/A'}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm">
                      {device.softwareInfo?.androidVersion || 'N/A'}
                    </p>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        device.state || 'UNKNOWN'
                      )}`}
                    >
                      {device.state || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatDate(device.enrollmentTime || '')}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatDate(device.lastStatusReportTime || '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
