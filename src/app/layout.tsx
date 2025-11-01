import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs'
import { ConvexClientProvider } from '@/components/convex-client-provider'
import "./globals.css";

export const metadata: Metadata = {
  title: "bbtec-mdm | Educational MDM System",
  description: "Android Device Management with Android Management API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
