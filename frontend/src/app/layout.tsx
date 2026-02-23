import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FieldSight Live',
  description: 'AI-Assisted Field Technician Companion',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
