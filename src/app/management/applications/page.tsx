import { DashboardLayout } from "@/components/dashboard-layout"
import { ApplicationsManager } from "@/components/applications-manager"

export default function ApplicationsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage APK files to deploy to your managed devices
          </p>
        </div>

        <ApplicationsManager />
      </div>
    </DashboardLayout>
  )
}
