"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AuthLoading>

      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>

      <Unauthenticated>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              bbtec-mdm
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Educational Android Mobile Device Management
            </p>
            <div className="bg-white rounded-lg shadow-lg p-8">
              <p className="text-sm text-slate-600 mb-6">
                Manage Android Enterprise devices with ease
              </p>
              <div className="flex flex-col gap-3">
                <Link href="/sign-in">
                  <Button className="w-full">Sign In</Button>
                </Link>
                <Link href="/sign-up">
                  <Button variant="outline" className="w-full">Create Account</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Unauthenticated>
    </>
  )
}

function RedirectToDashboard() {
  const router = useRouter()

  useEffect(() => {
    router.push("/dashboard")
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
    </div>
  )
}
