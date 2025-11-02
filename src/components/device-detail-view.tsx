"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowLeft, Smartphone, Calendar, Wifi, HardDrive, Package, Download, AlertCircle, Check } from "lucide-react"
import { installAppOnDevice } from "@/app/actions/android-management"
import type { Id } from "../../convex/_generated/dataModel"

interface Device {
  name?: string | null
  enrollmentTime?: string | null
  lastStatusReportTime?: string | null
  appliedState?: string | null
  state?: string | null
  hardwareInfo?: {
    model?: string | null
    manufacturer?: string | null
    serialNumber?: string | null
    brand?: string | null
  } | null
  softwareInfo?: {
    androidVersion?: string | null
    androidBuildNumber?: string | null
  } | null
  policyCompliant?: boolean | null
  memoryInfo?: {
    totalRam?: string | null
    totalInternalStorage?: string | null
  } | null
}

interface DeviceDetailViewProps {
  device: Device
  onBack: () => void
}

export function DeviceDetailView({ device, onBack }: DeviceDetailViewProps) {
  const [installDialogOpen, setInstallDialogOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Id<"applications"> | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installSuccess, setInstallSuccess] = useState(false)
  const [pingInterval, setPingInterval] = useState<number>(15)
  const [updatingInterval, setUpdatingInterval] = useState(false)

  const updatePingInterval = useMutation(api.deviceClients.updatePingInterval)

  const getDeviceId = (deviceName: string) => {
    const parts = deviceName.split('/')
    return parts[parts.length - 1]
  }

  const applications = useQuery(api.applications.listApplications)

  // Get client app connection status
  const deviceClient = useQuery(api.deviceClients.getByAndroidDeviceId, {
    androidDeviceId: device.name ? getDeviceId(device.name) : ''
  })

  // Get pending installation commands
  const pendingInstalls = useQuery(api.installCommands.getByDevice, {
    deviceId: device.name ? getDeviceId(device.name) : ''
  })

  const formatDate = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  }

  const formatBytes = (bytes: string) => {
    if (!bytes) return 'N/A'
    const gb = parseInt(bytes) / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }

  const getConnectionStatusColor = (lastHeartbeat: number) => {
    const now = Date.now()
    const diff = now - lastHeartbeat
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'bg-green-500'
    if (minutes <= 3) return 'bg-yellow-500'
    return 'bg-red-500'
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

  const handleUpdateInterval = async () => {
    if (!device.name) return

    setUpdatingInterval(true)
    try {
      const deviceId = getDeviceId(device.name)
      await updatePingInterval({
        deviceId,
        pingInterval,
      })
    } catch (error) {
      console.error('Failed to update interval:', error)
    } finally {
      setUpdatingInterval(false)
    }
  }

  const handleInstallApp = async () => {
    if (!selectedApp || !device.name) return

    const app = applications?.find(a => a._id === selectedApp)
    if (!app) return

    setInstalling(true)
    setInstallError(null)
    setInstallSuccess(false)

    try {
      const deviceId = getDeviceId(device.name)

      // Generate public URL for the APK
      const baseUrl = window.location.origin
      const apkUrl = `${baseUrl}/api/apps/${app.storageId}`

      const result = await installAppOnDevice(
        deviceId,
        app.packageName,
        apkUrl
      )

      if (result.success) {
        setInstallSuccess(true)
        // Auto-close after showing success message
        setTimeout(() => {
          setInstallDialogOpen(false)
          setInstallSuccess(false)
          setSelectedApp(null)
        }, 3000)
      } else {
        setInstallError(result.error || 'Failed to install app')
      }
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setInstalling(false)
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
        <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Install App
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Install Application</DialogTitle>
              <DialogDescription>
                Select an application to install on this device
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Application List */}
              {applications === undefined ? (
                <div className="flex items-center justify-center p-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                </div>
              ) : applications.length === 0 ? (
                <div className="text-center p-8">
                  <Package className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No applications uploaded yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {applications.map((app) => (
                    <div
                      key={app._id}
                      className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedApp === app._id
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedApp(app._id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-blue-100 p-2">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{app.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {app.packageName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            v{app.versionName} ({app.versionCode})
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Success Message */}
              {installSuccess && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-green-700 font-medium mb-2">
                        Installation queued successfully!
                      </p>
                      <p className="text-sm text-green-700">
                        The app will install silently when the device checks in (within 15 minutes).
                      </p>
                      <p className="text-xs text-green-600 mt-2">
                        Check the &quot;Pending Installations&quot; section on the device detail page to monitor progress.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {installError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <p className="text-sm text-red-700">{installError}</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setInstallDialogOpen(false)}
                disabled={installing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInstallApp}
                disabled={!selectedApp || installing || installSuccess}
              >
                {installing ? 'Installing...' : 'Install'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Client App Status - Always visible */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${deviceClient ? getConnectionStatusColor(deviceClient.lastHeartbeat) : 'bg-gray-400'}`} />
            <h3 className="font-semibold">
              {deviceClient ? 'Client App Connected' : 'Waiting for Client Connection'}
            </h3>
          </div>
          {deviceClient && (
            <span className="text-xs text-muted-foreground">
              Last check-in: {formatTimestamp(deviceClient.lastHeartbeat)}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pingInterval" className="text-sm text-muted-foreground">
              Check-in Interval (1-180 minutes)
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="pingInterval"
                type="number"
                min="1"
                max="180"
                value={pingInterval}
                onChange={(e) => setPingInterval(Number(e.target.value))}
                className="w-24"
              />
              <Button
                onClick={handleUpdateInterval}
                disabled={updatingInterval || pingInterval < 1 || pingInterval > 180}
                size="sm"
              >
                {updatingInterval ? 'Updating...' : 'Update'}
              </Button>
              {deviceClient && (
                <span className="text-sm text-muted-foreground self-center">
                  Current: {deviceClient.pingInterval} min
                </span>
              )}
            </div>
          </div>
          {deviceClient && (
            <div className="text-sm">
              <span className="text-muted-foreground">Registered: </span>
              <span className="font-medium">{formatTimestamp(deviceClient.registeredAt)}</span>
            </div>
          )}
        </div>

          {pendingInstalls && pendingInstalls.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-sm">Pending Installations ({pendingInstalls.length})</h4>
              </div>
              <div className="space-y-2">
                {pendingInstalls.slice(0, 5).map((cmd) => (
                  <div key={cmd._id} className="flex items-center justify-between p-2 bg-blue-50 rounded text-xs">
                    <div>
                      <p className="font-medium">{cmd.appName}</p>
                      <p className="text-muted-foreground">{cmd.packageName}</p>
                    </div>
                    <span className={`px-2 py-1 rounded ${
                      cmd.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      cmd.status === 'completed' ? 'bg-green-100 text-green-800' :
                      cmd.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {cmd.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

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
