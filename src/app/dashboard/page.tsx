"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/home/dashboard")
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
    </div>
  )
}
