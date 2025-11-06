import { DashboardLayout } from "@/components/dashboard-layout"
import { QRCodeGenerator } from "@/components/qr-code-generator"
import { DpcApkManager } from "@/components/dpc-apk-manager"
import { Separator } from "@/components/ui/separator"

export default function QRCodesPage() {
  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">QR Code Enrollment</h1>
        <p className="text-muted-foreground mb-8">
          Manage your DPC APK versions and generate QR codes for device enrollment
        </p>

        {/* APK Management Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-2">Step 1: Manage DPC APK</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Upload and manage your signed Android DPC APK versions. The current version will be used for QR codes.
          </p>
          <DpcApkManager />
        </div>

        <Separator className="my-8" />

        {/* QR Code Generation Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-2">Step 2: Generate QR Code</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select a policy and generate a QR code for device provisioning.
          </p>
          <QRCodeGenerator />
        </div>
      </div>
    </DashboardLayout>
  )
}
