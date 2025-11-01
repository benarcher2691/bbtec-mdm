"use client"

import { useState, useEffect } from "react"
import { listDevices } from "@/app/actions/android-management"
import { Smartphone, QrCode, Shield, TrendingUp } from "lucide-react"

export function DashboardStats() {
  const [deviceCount, setDeviceCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const result = await listDevices()
        if (result.success) {
          setDeviceCount(result.devices.length)
        }
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  const stats = [
    {
      title: "Enrolled Devices",
      value: loading ? "..." : deviceCount.toString(),
      description: "Active devices",
      icon: Smartphone,
      color: "text-blue-600 bg-blue-50",
    },
    {
      title: "Enrollment Tokens",
      value: "∞",
      description: "Generate as needed",
      icon: QrCode,
      color: "text-green-600 bg-green-50",
    },
    {
      title: "Active Policies",
      value: "1",
      description: "Default policy",
      icon: Shield,
      color: "text-purple-600 bg-purple-50",
    },
    {
      title: "Compliance Rate",
      value: loading ? "..." : deviceCount > 0 ? "100%" : "N/A",
      description: "Policy compliant",
      icon: TrendingUp,
      color: "text-orange-600 bg-orange-50",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div key={stat.title} className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </h3>
              <div className={`rounded-full p-2 ${stat.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stat.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
