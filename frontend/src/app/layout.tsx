import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, DM_Sans } from 'next/font/google'
import './globals.css'
import { SidebarNav } from '@/components/SidebarNav'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FieldSight Live | AI-Assisted Field Technician',
  description: 'Real-time AI-powered field technician companion for equipment inspection, fault detection, and repair guidance.',
  keywords: ['field technician', 'AI', 'equipment inspection', 'Gemini', 'fault detection'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FieldSight',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-900 dark:text-slate-100">
        <div className="min-h-screen flex flex-col lg:flex-row">
          <SidebarNav />
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
