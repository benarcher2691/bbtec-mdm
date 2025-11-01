import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bbtec-mdm | Educational MDM System",
  description: "Android Device Management with Android Management API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.Node;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
