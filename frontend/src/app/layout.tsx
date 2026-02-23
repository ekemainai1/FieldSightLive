import type { Metadata } from 'next'
import './globals.css'
import { SidebarNav } from '@/components/SidebarNav'

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
      <body>
        <div className="min-h-screen md:flex">
          <SidebarNav />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  )
}
