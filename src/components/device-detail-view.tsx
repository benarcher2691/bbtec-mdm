"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const applications = useQuery(api.applications.listApplications)

  const getDeviceId = (deviceName: string) => {
    const parts = deviceName.split('/')
    return parts[parts.length - 1]
  }

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
        if (result.downloadUrl) {
          setDownloadUrl(result.downloadUrl)
        } else {
          // Auto-close only if no download URL (Google Play apps)
          setTimeout(() => {
            setInstallDialogOpen(false)
            setInstallSuccess(false)
            setSelectedApp(null)
          }, 2000)
        }
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
                        Application added to policy
                      </p>
                      {downloadUrl ? (
                        <>
                          <p className="text-sm text-green-700 mb-3">
                            <strong>Manual installation required:</strong> Self-hosted APKs cannot be automatically installed via Android Management API.
                          </p>
                          <div className="bg-white rounded p-3 border border-green-200">
                            <p className="text-xs font-medium text-green-900 mb-2">Download Link:</p>
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 underline break-all"
                            >
                              {downloadUrl}
                            </a>
                          </div>
                          <p className="text-xs text-green-600 mt-3">
                            Users will need to enable "Unknown Sources" and download this APK manually.
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-green-700">
                          If this is a Google Play app, it will install automatically within a few minutes.
                        </p>
                      )}
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
