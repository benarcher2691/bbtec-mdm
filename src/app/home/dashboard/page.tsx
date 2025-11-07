import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardStats } from "@/components/dashboard-stats"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { QrCode, Smartphone, Shield } from "lucide-react"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to bbtec-mdm - Educational Android Mobile Device Management
          </p>
        </div>

        {/* Stats */}
        <DashboardStats />

        <Separator />

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/enrollment/enroll-device">
              <div className="rounded-lg border bg-card p-6 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-blue-100 p-3">
                    <QrCode className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Generate QR Code</h3>
                    <p className="text-sm text-muted-foreground">
                      Create enrollment tokens for new devices
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/management/devices">
              <div className="rounded-lg border bg-card p-6 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-green-100 p-3">
                    <Smartphone className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">View Devices</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage enrolled Android devices
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/management/configuration-profiles">
              <div className="rounded-lg border bg-card p-6 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-purple-100 p-3">
                    <Shield className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Manage Policies</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure device policies (Coming soon)
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Getting Started */}
        <div className="rounded-lg border bg-slate-50 p-6">
          <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold">
                1
              </span>
              <div>
                <p className="font-medium">Generate an enrollment QR code</p>
                <p className="text-muted-foreground">
                  Navigate to Enrollment → Enroll device and generate a token
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold">
                2
              </span>
              <div>
                <p className="font-medium">Factory reset an Android device</p>
                <p className="text-muted-foreground">
                  Or use a new device fresh out of the box
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold">
                3
              </span>
              <div>
                <p className="font-medium">Scan the QR code during setup</p>
                <p className="text-muted-foreground">
                  The device will automatically enroll and apply policies
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold">
                4
              </span>
              <div>
                <p className="font-medium">Manage your device</p>
                <p className="text-muted-foreground">
                  View and manage enrolled devices from Management → Devices
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </DashboardLayout>
  )
}
