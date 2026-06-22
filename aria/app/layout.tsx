import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ARIA',
  description: 'Adaptive Reasoning Intelligence Assistant — AIXMOS Node Zero',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', fontFamily: 'monospace' }}>
        {children}
      </body>
    </html>
  )
}
