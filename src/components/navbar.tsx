"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { UserButton } from "@clerk/nextjs"
import { Menu } from "lucide-react"
import { Sidebar } from "./sidebar"
import { useSidebar } from "./dashboard-layout"
import packageJson from "../../package.json"

export function Navbar() {
  const { toggle } = useSidebar()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Desktop Hamburger Menu */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex"
          onClick={toggle}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile Hamburger Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[236px] p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Branding */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">bbtec-mdm</span>
          <span className="text-xs text-muted-foreground">v{packageJson.version}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User Badge */}
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8"
            }
          }}
          afterSignOutUrl="/sign-in"
        />
      </div>
    </header>
  )
}
