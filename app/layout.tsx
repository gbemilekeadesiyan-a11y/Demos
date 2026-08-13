import type { Metadata } from 'next'
import { headingFont } from './fonts'
import { ThemeToggle } from '@/components/ThemeToggle'
import './globals.css'

export const metadata: Metadata = {
  title: 'dēmos',
  description: 'A consensus/voting platform',
}

// Applies the persisted (or system-default) theme before first paint, so
// there's no flash of the wrong theme while React hydrates. Deliberately a
// plain inline script, not a client component — it must run synchronously
// ahead of any rendering. See CLAUDE.md's Conventions section.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${headingFont.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ThemeToggle className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-base shadow-lg transition hover:bg-surface-hover" />
      </body>
    </html>
  )
}
