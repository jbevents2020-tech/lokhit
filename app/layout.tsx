import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lokhit Newsroom",
  description: "Lokhit Newsroom for Marathi digital journalism",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mr">
      <body>{children}</body>
    </html>
  );
}
