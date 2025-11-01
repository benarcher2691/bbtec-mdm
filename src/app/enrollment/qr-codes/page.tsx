import { DashboardLayout } from "@/components/dashboard-layout"
import { QRCodeGenerator } from "@/components/qr-code-generator"

export default function QRCodesPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">QR Code Enrollment</h1>
        <p className="text-muted-foreground mb-8">
          Generate QR codes for device enrollment using Android Management API
        </p>

        <QRCodeGenerator />
      </div>
    </DashboardLayout>
  )
}
