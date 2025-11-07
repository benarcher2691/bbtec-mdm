"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight, Smartphone, QrCode, Package, Home, Download, Settings, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface NavSection {
  title: string
  items: NavItem[]
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navigationSections: NavSection[] = [
  {
    title: "Home",
    items: [
      { title: "Dashboard", href: "/home/dashboard", icon: Home },
    ],
  },
  {
    title: "Enrollment",
    items: [
      { title: "Update MDM client", href: "/enrollment/update-client", icon: Download },
      { title: "Enroll device", href: "/enrollment/enroll-device", icon: QrCode },
    ],
  },
  {
    title: "Management",
    items: [
      { title: "Devices", href: "/management/devices", icon: Smartphone },
      { title: "Configuration profiles", href: "/management/configuration-profiles", icon: Settings },
    ],
  },
  {
    title: "Company",
    items: [
      { title: "Users", href: "/company/users", icon: Users },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Home: true,
    Enrollment: true,
    Management: true,
    Company: true,
  })

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto p-4 pt-6">
        <div className="space-y-4">
          {navigationSections.map((section) => (
            <div key={section.title}>
              {/* Section Header */}
              <Button
                variant="ghost"
                className="w-full justify-between px-2 font-semibold text-sm"
                onClick={() => toggleSection(section.title)}
              >
                {section.title}
                {expandedSections[section.title] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>

              {/* Section Items */}
              {expandedSections[section.title] && (
                <div className="mt-1 space-y-1 pl-2">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className={cn(
                            "w-full justify-start gap-2",
                            isActive && "bg-secondary"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.title}
                        </Button>
                      </Link>
                    )
                  })}
                </div>
              )}

              <Separator className="mt-4" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}
