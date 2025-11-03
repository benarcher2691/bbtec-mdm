"use client"

import { useState, useEffect } from "react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { listDevices, deleteDevice } from "@/app/actions/android-management"
import { Smartphone, RefreshCw, AlertCircle, MoreVertical, Trash2 } from "lucide-react"
import { DeviceDetailView } from "./device-detail-view"

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

export function DeviceListTable() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleteWithWipe, setDeleteWithWipe] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Reset selection and reload when navigating to devices list (without specific device)
  useEffect(() => {
    console.log('[DeviceList] Effect 1 - pathname:', pathname, 'deviceId:', searchParams.get('deviceId'))
    if (pathname === '/management/devices' && !searchParams.get('deviceId')) {
      console.log('[DeviceList] Resetting selection and reloading devices')
      setSelectedDevice(null)
      loadDevices()
    }
  }, [pathname, searchParams])

  // Auto-select device when URL has deviceId param and devices are loaded
  useEffect(() => {
    const deviceId = searchParams.get('deviceId')
    console.log('[DeviceList] Effect 2 - deviceId:', deviceId, 'devices.length:', devices.length, 'selectedDevice:', selectedDevice?.name)
    if (pathname === '/management/devices' && deviceId && devices.length > 0) {
      const device = devices.find(d => d.name?.endsWith(deviceId))
      if (device) {
        console.log('[DeviceList] Auto-selecting device:', deviceId)
        setSelectedDevice(device)
      }
    }
  }, [pathname, searchParams, devices])

  // Debug: Log when selectedDevice changes
  useEffect(() => {
    console.log('[DeviceList] selectedDevice changed:', selectedDevice ? getDeviceId(selectedDevice.name!) : 'null')
  }, [selectedDevice])

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

  const handleDeleteClick = (device: Device, withWipe: boolean) => {
    if (!device.name) return

    const deviceId = getDeviceId(device.name)
    const deviceDisplayName = device.hardwareInfo?.model || deviceId

    setDeviceToDelete({ id: deviceId, name: deviceDisplayName })
    setDeleteWithWipe(withWipe)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deviceToDelete) return

    setDeleting(true)

    try {
      const result = await deleteDevice(deviceToDelete.id, deleteWithWipe)

      if (result.success) {
        // Remove device from local state
        setDevices(devices.filter(d => !d.name?.endsWith(deviceToDelete.id)))
        setDeleteDialogOpen(false)
        setDeviceToDelete(null)
        // Close detail view if deleted device was selected
        if (selectedDevice?.name?.endsWith(deviceToDelete.id)) {
          setSelectedDevice(null)
        }
      } else {
        setError(result.error || 'Failed to delete device')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeviceDoubleClick = (device: Device) => {
    console.log('[DeviceList] Double-clicked device:', device.name)
    const deviceId = getDeviceId(device.name!)
    console.log('[DeviceList] Navigating to device:', deviceId)
    // Update URL with deviceId - this will trigger auto-select via Effect 2
    router.push(`/management/devices?deviceId=${deviceId}`)
  }

  const handleBackToList = () => {
    console.log('[DeviceList] Back to list clicked')
    // Navigate to devices list without deviceId - this will trigger reset via Effect 1
    router.push('/management/devices')
  }

  const getDeviceId = (deviceName: string) => {
    // Extract device ID from full name (enterprises/xxx/devices/yyy)
    const parts = deviceName.split('/')
    return parts[parts.length - 1]
  }

  const formatDate = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
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

  // Show device detail view if a device is selected
  if (selectedDevice) {
    return <DeviceDetailView device={selectedDevice} onBack={handleBackToList} />
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
                <th className="text-left p-4 font-medium text-sm w-12"></th>
                <th className="text-left p-4 font-medium text-sm">Software version</th>
                <th className="text-left p-4 font-medium text-sm">User</th>
                <th className="text-left p-4 font-medium text-sm">Last reported</th>
                <th className="text-left p-4 font-medium text-sm">Tags</th>
                <th className="text-left p-4 font-medium text-sm w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {devices.map((device) => (
                <tr
                  key={device.name}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onDoubleClick={() => handleDeviceDoubleClick(device)}
                >
                  {/* Status Indicator (colored dot) */}
                  <td className="p-4">
                    <div className="flex items-center justify-center">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          device.state === 'ACTIVE'
                            ? 'bg-green-500'
                            : device.state === 'PROVISIONING'
                            ? 'bg-blue-500'
                            : device.state === 'DISABLED'
                            ? 'bg-red-500'
                            : 'bg-gray-500'
                        }`}
                        title={device.state || 'UNKNOWN'}
                      />
                    </div>
                  </td>

                  {/* Software Version (Android version) */}
                  <td className="p-4">
                    <p className="text-sm">
                      {device.softwareInfo?.androidVersion || 'N/A'}
                    </p>
                  </td>

                  {/* User */}
                  <td className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Admin
                    </p>
                  </td>

                  {/* Last Reported */}
                  <td className="p-4">
                    <p className="text-sm text-muted-foreground">
                      {formatDate(device.lastStatusReportTime || '')}
                    </p>
                  </td>

                  {/* Tags */}
                  <td className="p-4">
                    <p className="text-sm text-muted-foreground">
                      {device.hardwareInfo?.model || '-'}
                    </p>
                  </td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteClick(device, true)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete & Wipe Device
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(device, false)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove from List
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              {deleteWithWipe ? 'Delete & Wipe Device?' : 'Remove Device?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteWithWipe ? (
                <>
                  This will <strong className="text-red-600">factory reset</strong> the device{' '}
                  <strong>{deviceToDelete?.name}</strong> and remove it from management.
                  <br /><br />
                  <strong>All data on the device will be permanently erased.</strong>
                  <br /><br />
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Remove device <strong>{deviceToDelete?.name}</strong> from the enterprise?
                  <br /><br />
                  This is useful if the device has already been manually factory reset.
                  The device will no longer appear in the device list.
                  <br /><br />
                  If the device is still enrolled, it will continue to be managed until manually reset.
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
              {deleting ? 'Processing...' : deleteWithWipe ? 'Delete & Wipe' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
