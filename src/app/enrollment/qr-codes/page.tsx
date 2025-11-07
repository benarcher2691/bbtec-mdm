"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function QRCodesPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/enrollment/enroll-device")
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  )
}
