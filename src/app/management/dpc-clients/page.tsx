import { DashboardLayout } from "@/components/dashboard-layout"
import { DpcClientsList } from "@/components/dpc-clients-list"

export default function DpcClientsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">DPC Clients</h1>
        <p className="text-muted-foreground mb-8">
          View and manage devices enrolled through QR code provisioning
        </p>

        <DpcClientsList />
      </div>
    </DashboardLayout>
  )
}
