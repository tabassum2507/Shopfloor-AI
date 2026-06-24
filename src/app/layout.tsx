import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import { AuthProvider } from '@/lib/auth-context'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ShopFloor AI — AI-Powered Production Tracking ERP',
  description: 'Track production orders, manage inventory, and query your shop floor with an AI assistant that speaks Hindi and English. Built as a solo PM portfolio project.',
  openGraph: {
    title: 'ShopFloor AI',
    description: 'AI-powered production tracking for manufacturers. Voice-enabled AI assistant, Kanban board, real-time inventory.',
    url: 'https://shopfloor-ai.vercel.app',
    siteName: 'ShopFloor AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShopFloor AI',
    description: 'AI-powered production tracking for manufacturers',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
