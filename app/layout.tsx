import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MobileBottomNav } from "./components/mobile-bottom-nav";

export const metadata: Metadata = {
  title: "Lokhit Newsroom",
  description: "Lokhit Newsroom for Marathi digital journalism",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mr">
      <body>{children}<MobileBottomNav /></body>
    </html>
  );
}
