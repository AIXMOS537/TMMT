import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIX Command Center",
  description: "Portfolio command center and venture operations",
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
        {children}
      </body>
    </html>
  );
}
