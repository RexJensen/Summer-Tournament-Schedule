import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vegas Summer 2026 · Poker Schedule",
  description: "Las Vegas summer 2026 tournament poker schedule with per-event tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
