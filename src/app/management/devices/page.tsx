import { DashboardLayout } from "@/components/dashboard-layout"
import { DeviceListTable } from "@/components/device-list-table"

export default function DevicesPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Device Management</h1>
        <p className="text-muted-foreground mb-8">
          View and manage enrolled Android devices from Android Management API
        </p>

        <DeviceListTable />
      </div>
    </DashboardLayout>
  )
}
