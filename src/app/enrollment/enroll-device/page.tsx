import { DashboardLayout } from "@/components/dashboard-layout"
import { QRCodeGenerator } from "@/components/qr-code-generator"

export default function EnrollDevicePage() {
  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Enroll Device</h1>
        <p className="text-muted-foreground mb-8">
          Select a policy and generate a QR code for device provisioning with BBTec MDM Client.
        </p>

        {/* QR Code Generation Section */}
        <QRCodeGenerator />
      </div>
    </DashboardLayout>
  )
}
