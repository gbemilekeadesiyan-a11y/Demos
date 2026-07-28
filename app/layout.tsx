import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'dēmos',
  description: 'A consensus/voting platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
