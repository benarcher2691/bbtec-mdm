import { DashboardLayout } from "@/components/dashboard-layout"
import { CompanyUsersManager } from "@/components/company-users-manager"
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
          Manage company users and device assignments
        </p>

        <CompanyUsersManager />
      </div>
    </DashboardLayout>
  )
}
