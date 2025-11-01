"use client"

import { ReactNode } from "react"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { Navbar } from "./navbar"
import { Sidebar } from "./sidebar"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
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

      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>

      <Authenticated>
        <div className="flex h-screen flex-col">
          {/* Navbar - always visible */}
          <Navbar />

          <div className="flex flex-1 overflow-hidden">
            {/* Desktop Sidebar - hidden on mobile */}
            <aside className="hidden md:flex w-72 border-r">
              <Sidebar />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
              {children}
            </main>
          </div>
        </div>
      </Authenticated>
    </>
  )
}

function RedirectToSignIn() {
  const router = useRouter()

  useEffect(() => {
    router.push("/sign-in")
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
    </div>
  )
}
