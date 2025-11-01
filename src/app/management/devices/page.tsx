import { DashboardLayout } from "@/components/dashboard-layout"

export default function DevicesPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Device Management</h1>
        <p className="text-muted-foreground mb-8">
          View and manage enrolled Android devices
        </p>

        <div className="rounded-lg border bg-card">
          <div className="p-6">
            <p className="text-center text-muted-foreground">
              Device list table will be implemented here
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
