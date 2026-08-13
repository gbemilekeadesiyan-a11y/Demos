import type { Metadata } from 'next'
import { headingFont } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'dēmos',
  description: 'A consensus/voting platform',
}

// Applies the persisted theme before first paint, so there's no flash of
// the wrong theme while React hydrates. Deliberately a plain inline script,
// not a client component — it must run synchronously ahead of any
// rendering. See CLAUDE.md's Conventions section.
//
// Defaults to dark for a first-time visitor (no stored preference) — no
// longer falls back to prefers-color-scheme, per an explicit product
// decision that dark is the app's default look regardless of OS setting.
// ThemeToggle (rendered in each page's header, not globally anymore) is how
// someone actually gets to light mode, and its choice is what gets stored.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
