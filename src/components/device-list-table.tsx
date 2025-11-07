"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Smartphone, RefreshCw, AlertCircle, Trash2, Clock, Check, X, Download, Package } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useSearchParams, useRouter } from "next/navigation"
import type { Id } from "../../convex/_generated/dataModel"

export function DeviceListTable() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const deviceId = searchParams.get('device')

  // State for Install App dialog
  const [installDialogOpen, setInstallDialogOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Id<"applications"> | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installSuccess, setInstallSuccess] = useState(false)

  // Queries and mutations
  const devices = useQuery(api.deviceClients.listDevices)
  const applications = useQuery(api.applications.listApplications)
  const selectedDevice = devices?.find(d => d.deviceId === deviceId) || null
  const deleteDeviceMutation = useMutation(api.deviceClients.deleteDevice)
  const updatePingIntervalMutation = useMutation(api.deviceClients.updatePingInterval)
  const createInstallCommand = useMutation(api.installCommands.create)
  const getDownloadUrl = useQuery(api.applications.getDownloadUrl,
    selectedApp && applications
      ? { storageId: applications.find(a => a._id === selectedApp)?.storageId ?? ("" as Id<"_storage">) }
      : "skip"
  )

  // Auto-navigate back to device list when selected device is deleted
  // This happens when wipe command completes and device is auto-removed
  useEffect(() => {
    if (deviceId && devices && !selectedDevice) {
      // User was viewing a specific device, but it no longer exists
      // Navigate back to device list
      router.push('/management/devices')
    }
  }, [deviceId, devices, selectedDevice, router])

  // Get pending commands for selected device
  const commandHistory = useQuery(
    api.deviceCommands.getCommandHistory,
    selectedDevice ? { deviceId: selectedDevice.deviceId } : "skip"
  )
  const pendingWipeCommand = commandHistory?.find(
    cmd => cmd.commandType === "wipe" && (cmd.status === "pending" || cmd.status === "executing")
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleteWithWipe, setDeleteWithWipe] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingPingInterval, setEditingPingInterval] = useState(false)
  const [pingIntervalValue, setPingIntervalValue] = useState("")
  const [savingPingInterval, setSavingPingInterval] = useState(false)
  const [pingIntervalError, setPingIntervalError] = useState<string | null>(null)

  const handleDeleteClick = (device: any, withWipe: boolean) => {
    setDeviceToDelete({
      id: device.deviceId,
      name: `${device.manufacturer} ${device.model}`
    })
    setDeleteWithWipe(withWipe)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deviceToDelete) return

    setDeleting(true)
    setError(null)

    try {
      await deleteDeviceMutation({
        deviceId: deviceToDelete.id,
        withWipe: deleteWithWipe,
      })
      setDeleteDialogOpen(false)
      setDeviceToDelete(null)

      // Only navigate away if device was actually deleted (not wiped)
      // When wiping, device stays in DB to receive the command
      if (!deleteWithWipe && selectedDevice?.deviceId === deviceToDelete.id) {
        router.push('/management/devices')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeviceDoubleClick = (device: any) => {
    router.push(`/management/devices?device=${device.deviceId}`)
  }

  const handleEditPingInterval = () => {
    if (selectedDevice) {
      setPingIntervalValue(selectedDevice.pingInterval.toString())
      setEditingPingInterval(true)
      setPingIntervalError(null)
    }
  }

  const handleCancelPingInterval = () => {
    setEditingPingInterval(false)
    setPingIntervalValue("")
    setPingIntervalError(null)
  }

  const handleSavePingInterval = async () => {
    if (!selectedDevice) return

    const interval = parseInt(pingIntervalValue, 10)

    if (isNaN(interval) || interval < 1 || interval > 180) {
      setPingIntervalError("Ping interval must be between 1 and 180 minutes")
      return
    }

    setSavingPingInterval(true)
    setPingIntervalError(null)

    try {
      await updatePingIntervalMutation({
        deviceId: selectedDevice.deviceId,
        pingInterval: interval,
      })
      setEditingPingInterval(false)
      setPingIntervalValue("")
    } catch (err) {
      setPingIntervalError(err instanceof Error ? err.message : "Failed to update ping interval")
    } finally {
      setSavingPingInterval(false)
    }
  }

  const handleInstallApp = async () => {
    if (!selectedApp || !selectedDevice || !getDownloadUrl) return

    setInstalling(true)
    setInstallError(null)

    try {
      const app = applications?.find(a => a._id === selectedApp)
      if (!app) throw new Error("Application not found")

      await createInstallCommand({
        deviceId: selectedDevice.deviceId,
        apkUrl: getDownloadUrl,
        packageName: app.packageName,
        appName: app.name,
      })

      setInstallSuccess(true)
      setTimeout(() => {
        setInstallDialogOpen(false)
        setSelectedApp(null)
        setInstallSuccess(false)
      }, 3000)
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Failed to queue installation")
    } finally {
      setInstalling(false)
    }
  }

  return (
    <>
      {/* Device detail view */}
      {selectedDevice && (
        <div className="space-y-4">
          {/* Pending Wipe Warning */}
          {pendingWipeCommand && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900">
                    {pendingWipeCommand.status === "executing" ? "Factory Reset In Progress" : "Factory Reset Pending"}
                  </h3>
                  <p className="text-sm text-orange-700 mt-1">
                    {pendingWipeCommand.status === "executing"
                      ? "The device received the factory reset command and is wiping now. It will not check in again after the wipe completes."
                      : `A factory reset command has been sent to this device. The device will be wiped when it checks in (within ${selectedDevice.pingInterval} minutes).`
                    }
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    After the wipe completes, you can remove this device from the list using &quot;Remove from List&quot;.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-card p-6">
          <h2 className="text-2xl font-bold mb-6">
            {selectedDevice.manufacturer} {selectedDevice.model}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Device Information</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium">Serial Number</dt>
                  <dd className="text-sm text-muted-foreground">{selectedDevice.serialNumber}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Android ID</dt>
                  <dd className="text-sm text-muted-foreground">{selectedDevice.androidId}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Android Version</dt>
                  <dd className="text-sm text-muted-foreground">{selectedDevice.androidVersion}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Management Mode</dt>
                  <dd className="text-sm">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedDevice.isDeviceOwner
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {selectedDevice.isDeviceOwner ? 'Device Owner' : 'Profile Owner'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Company</dt>
                  <dd className="text-sm text-muted-foreground">
                    {selectedDevice.companyName || <span className="italic">No company assigned</span>}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Status</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium">Current Status</dt>
                  <dd className="text-sm">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedDevice.status === 'online'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        selectedDevice.status === 'online' ? 'bg-green-600' : 'bg-gray-600'
                      }`} />
                      {selectedDevice.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Last Heartbeat</dt>
                  <dd className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(selectedDevice.lastHeartbeat), { addSuffix: true })}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Registered At</dt>
                  <dd className="text-sm text-muted-foreground">
                    {new Date(selectedDevice.registeredAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Ping Interval</dt>
                  <dd className="text-sm">
                    {editingPingInterval ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min="1"
                          max="180"
                          value={pingIntervalValue}
                          onChange={(e) => setPingIntervalValue(e.target.value)}
                          className="w-20 h-8"
                          disabled={savingPingInterval}
                        />
                        <span className="text-muted-foreground">minutes</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={handleSavePingInterval}
                          disabled={savingPingInterval}
                          title="Save"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={handleCancelPingInterval}
                          disabled={savingPingInterval}
                          title="Cancel"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{selectedDevice.pingInterval} minutes</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={handleEditPingInterval}
                          title="Edit ping interval"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {pingIntervalError && (
                      <p className="text-xs text-red-600 mt-1">{pingIntervalError}</p>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t flex gap-2">
            <Button
              onClick={() => setInstallDialogOpen(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              Install App
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteClick(selectedDevice, true)}
              disabled={!!pendingWipeCommand}
              title={pendingWipeCommand ? "Factory reset already pending" : "Send factory reset command to device"}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {pendingWipeCommand ? 'Wipe Pending' : 'Wipe Device'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDeleteClick(selectedDevice, false)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove from List
            </Button>
          </div>
        </div>
        </div>
      )}

      {/* Loading state */}
      {!selectedDevice && devices === undefined && (
        <div className="rounded-lg border bg-card p-12">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="text-sm text-muted-foreground">Loading devices...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {!selectedDevice && error && (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
      )}

      {/* Empty state */}
      {!selectedDevice && devices && devices.length === 0 && (
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
          <Button asChild>
            <a href="/enrollment/enroll-device">Enroll device</a>
          </Button>
        </div>
      </div>
      )}

      {/* Device list */}
      {!selectedDevice && devices && devices.length > 0 && (
        <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {devices.length} {devices.length === 1 ? 'device' : 'devices'} enrolled
        </p>
        <p className="text-xs text-muted-foreground">
          Double-click a device to view details and actions
        </p>
      </div>

      {/* Device Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-sm w-12"></th>
                <th className="text-left p-4 font-medium text-sm">Device</th>
                <th className="text-left p-4 font-medium text-sm">Company</th>
                <th className="text-left p-4 font-medium text-sm">Android Version</th>
                <th className="text-left p-4 font-medium text-sm">Status</th>
                <th className="text-left p-4 font-medium text-sm">Last Heartbeat</th>
                <th className="text-left p-4 font-medium text-sm">Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {devices.map((device) => (
                <tr
                  key={device._id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onDoubleClick={() => handleDeviceDoubleClick(device)}
                >
                  {/* Status Indicator (colored dot) */}
                  <td className="p-4">
                    <div className="flex items-center justify-center">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          device.status === 'online'
                            ? 'bg-green-500'
                            : 'bg-gray-500'
                        }`}
                        title={device.status}
                      />
                    </div>
                  </td>

                  {/* Device Info */}
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {device.manufacturer} {device.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Serial: {device.serialNumber}
                      </p>
                    </div>
                  </td>

                  {/* Company Name */}
                  <td className="p-4">
                    <p className="text-sm">
                      {device.companyName || <span className="text-muted-foreground italic">No company</span>}
                    </p>
                  </td>

                  {/* Android Version */}
                  <td className="p-4">
                    <p className="text-sm">{device.androidVersion}</p>
                  </td>

                  {/* Status Badge */}
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

                  {/* Last Heartbeat */}
                  <td className="p-4">
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(device.lastHeartbeat), { addSuffix: true })}
                    </p>
                  </td>

                  {/* Device Owner Badge */}
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      device.isDeviceOwner
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {device.isDeviceOwner ? 'Device Owner' : 'Profile Owner'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      )}

      {/* Install App Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Application</DialogTitle>
            <DialogDescription>
              Select an application to install on this device
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {applications === undefined ? (
              <div className="flex items-center justify-center p-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center p-8">
                <Package className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No applications uploaded yet. Upload an APK from the Applications page.
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

            {installSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-green-700 font-medium mb-2">
                      Installation queued successfully!
                    </p>
                    <p className="text-sm text-green-700">
                      The app will install silently when the device checks in (within {selectedDevice?.pingInterval || 15} minutes).
                    </p>
                  </div>
                </div>
              </div>
            )}

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteWithWipe ? 'Wipe Device?' : 'Remove Device?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteWithWipe ? (
                <>
                  This will send a <strong className="text-red-600">factory reset command</strong> to{' '}
                  <strong>{deviceToDelete?.name}</strong>.
                  <br /><br />
                  <strong>All data on the device will be permanently erased.</strong>
                  <br /><br />
                  The device will receive this command on its next check-in (within {selectedDevice?.pingInterval || 15} minutes).
                  After the wipe completes, you can remove it from the list manually.
                  <br /><br />
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Remove device <strong>{deviceToDelete?.name}</strong> from the device list?
                  <br /><br />
                  The device will be removed from management. If the device is still active,
                  it will continue to function normally but won&apos;t receive policy updates.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className={deleteWithWipe ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {deleting ? 'Processing...' : deleteWithWipe ? 'Wipe Device' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
