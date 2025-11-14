import { DashboardLayout } from "@/components/dashboard-layout"
import { DpcApkManager } from "@/components/dpc-apk-manager"

export default function UpdateClientPage() {
  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">MDM Client APK</h1>
        <p className="text-muted-foreground mb-8">
          Upload your signed BBTec MDM Client APK. This APK will be used for all device enrollments.
        </p>

        {/* APK Management Section */}
        <DpcApkManager />
      </div>
    </DashboardLayout>
  )
}
