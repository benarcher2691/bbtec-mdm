import { DashboardLayout } from "@/components/dashboard-layout"
import { DpcApkManager } from "@/components/dpc-apk-manager"

export default function UpdateClientPage() {
  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Update MDM Client</h1>
        <p className="text-muted-foreground mb-8">
          Upload and manage your signed BBTec MDM Client APK versions. The current version will be used for device enrollment.
        </p>

        {/* APK Management Section */}
        <DpcApkManager />
      </div>
    </DashboardLayout>
  )
}
