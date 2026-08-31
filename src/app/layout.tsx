import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "TMMT Rentals",
  description: "Vehicle rental management system",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TMMT" },
};

export const viewport: Viewport = {
  themeColor: "#0A1628",
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <PWARegister />
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
