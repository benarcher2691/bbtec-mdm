"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Smartphone, Calendar, Wifi, HardDrive, Battery } from "lucide-react"

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

interface DeviceDetailViewProps {
  device: Device
  onBack: () => void
}

export function DeviceDetailView({ device, onBack }: DeviceDetailViewProps) {
  const getDeviceId = (deviceName: string) => {
    const parts = deviceName.split('/')
    return parts[parts.length - 1]
  }

  const formatDate = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const formatBytes = (bytes: string) => {
    if (!bytes) return 'N/A'
    const gb = parseInt(bytes) / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
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

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">
            {device.hardwareInfo?.model || 'Unknown Device'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {device.name ? getDeviceId(device.name) : 'N/A'}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
            device.state || 'UNKNOWN'
          )}`}
        >
          {device.state || 'UNKNOWN'}
        </span>
      </div>

      <Separator />

      {/* Device Information Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Hardware Information */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">Hardware Information</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Manufacturer</dt>
              <dd className="font-medium">{device.hardwareInfo?.manufacturer || 'N/A'}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Model</dt>
              <dd className="font-medium">{device.hardwareInfo?.model || 'N/A'}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Brand</dt>
              <dd className="font-medium">{device.hardwareInfo?.brand || 'N/A'}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Serial Number</dt>
              <dd className="font-medium font-mono text-xs">
                {device.hardwareInfo?.serialNumber || 'N/A'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Software Information */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wifi className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold">Software Information</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Android Version</dt>
              <dd className="font-medium">{device.softwareInfo?.androidVersion || 'N/A'}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Build Number</dt>
              <dd className="font-medium font-mono text-xs">
                {device.softwareInfo?.androidBuildNumber || 'N/A'}
              </dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Policy Compliant</dt>
              <dd className="font-medium">
                {device.policyCompliant ? (
                  <span className="text-green-600">✓ Yes</span>
                ) : (
                  <span className="text-red-600">✗ No</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Memory Information */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold">Memory Information</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total RAM</dt>
              <dd className="font-medium">
                {device.memoryInfo?.totalRam
                  ? formatBytes(device.memoryInfo.totalRam)
                  : 'N/A'}
              </dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Internal Storage</dt>
              <dd className="font-medium">
                {device.memoryInfo?.totalInternalStorage
                  ? formatBytes(device.memoryInfo.totalInternalStorage)
                  : 'N/A'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Enrollment Information */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold">Enrollment Information</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Enrolled</dt>
              <dd className="font-medium">{formatDate(device.enrollmentTime || '')}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last Contact</dt>
              <dd className="font-medium">
                {formatDate(device.lastStatusReportTime || '')}
              </dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Applied State</dt>
              <dd className="font-medium">{device.appliedState || 'N/A'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Additional Information */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Device Name (Full)</h3>
        <code className="block p-3 bg-slate-100 rounded text-xs font-mono break-all">
          {device.name || 'N/A'}
        </code>
      </div>
    </div>
  )
}
