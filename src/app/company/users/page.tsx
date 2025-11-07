import { DashboardLayout } from "@/components/dashboard-layout"
import { Users } from "lucide-react"

export default function UsersPage() {
  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-3xl font-bold">Users</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Manage company users and permissions
        </p>

        {/* Placeholder Content */}
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <Users className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">
            Coming Soon
          </h2>
          <p className="text-slate-600 max-w-md mx-auto">
            User management functionality will be available in a future release.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
