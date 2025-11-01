import { DashboardLayout } from "@/components/dashboard-layout"

export default function QRCodesPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">QR Code Enrollment</h1>
        <p className="text-muted-foreground mb-8">
          Generate QR codes for device enrollment
        </p>

        <div className="rounded-lg border bg-card p-6">
          <p className="text-center text-muted-foreground">
            QR code generation will be implemented here
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
