"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
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
import { Smartphone, RefreshCw, AlertCircle, Trash2, ArrowLeft } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export function DeviceListTable() {
  const devices = useQuery(api.deviceClients.listDevices)
  const deleteDeviceMutation = useMutation(api.deviceClients.deleteDevice)

  const [selectedDevice, setSelectedDevice] = useState<any | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleteWithWipe, setDeleteWithWipe] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      // Close detail view if deleted device was selected
      if (selectedDevice?.deviceId === deviceToDelete.id) {
        setSelectedDevice(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeviceDoubleClick = (device: any) => {
    setSelectedDevice(device)
  }

  const handleBackToList = () => {
    setSelectedDevice(null)
  }

  // Show device detail view if selected
  if (selectedDevice) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={handleBackToList}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>

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
                  <dd className="text-sm text-muted-foreground">{selectedDevice.pingInterval} minutes</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t flex gap-2">
            <Button
              variant="destructive"
              onClick={() => handleDeleteClick(selectedDevice, true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Wipe Device
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
    )
  }

  if (devices === undefined) {
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
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
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
          <Button asChild>
            <a href="/enrollment/enroll-device">Generate QR Code</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
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
                  <strong>{deviceToDelete?.name}</strong> and remove it from management.
                  <br /><br />
                  <strong>All data on the device will be permanently erased.</strong>
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
    </div>
  )
}
