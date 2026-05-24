// src/app/layout.tsx
import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Allo — Inventory",
  description: "Multi-warehouse inventory and order-fulfillment platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[#0a0a0a] text-[#f0ece3] antialiased">
        <header className="border-b border-white/8 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-[#e8ff47] rounded-sm flex items-center justify-center">
                <span className="text-[#0a0a0a] font-syne font-800 text-sm tracking-tighter">A</span>
              </div>
              <span className="font-syne font-700 text-lg tracking-tight text-white">
                allo
              </span>
              <span className="text-white/30 text-sm font-dm-sans ml-1">inventory</span>
            </a>
            <nav className="flex items-center gap-6 text-sm text-white/50 font-dm-sans">
              <a href="/" className="hover:text-white/90 transition-colors">Products</a>
              <a href="/warehouses" className="hover:text-white/90 transition-colors">Warehouses</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
