'use client'

import { useEffect, useState } from 'react'

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

// Glass-morphism switch (backdrop-blur track, floating pill thumb) — same
// visual language as the rest of the app's cards
// (border-foreground/10 + bg-foreground/5 + backdrop-blur), just shaped
// as a toggle instead of a panel. Deliberately bigger/higher-contrast than
// the old plain-emoji icon button it replaces, and rendered inline in each
// page's header next to the profile control rather than as one
// globally-fixed corner button (see app/layout.tsx).
export function ThemeToggle({ className }: { className?: string }) {
  // Unknown until mount — the real state lives on <html class="dark">,
  // set synchronously by the inline script in app/layout.tsx before this
  // component ever renders, so reading it here (not re-deriving from
  // localStorage) is what keeps this in sync with that script.
  const [isDark, setIsDark] = useState<boolean | null>(null)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setIsDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      aria-pressed={isDark ?? undefined}
      className={`relative inline-flex h-8 w-[3.75rem] shrink-0 items-center rounded-full border border-foreground/10 bg-foreground/5 backdrop-blur-md transition-colors hover:bg-foreground/10 ${className ?? ''}`}
    >
      <span className="flex w-1/2 items-center justify-center text-subtle">
        <SunIcon className="h-3.5 w-3.5" />
      </span>
      <span className="flex w-1/2 items-center justify-center text-subtle">
        <MoonIcon className="h-3.5 w-3.5" />
      </span>
      {isDark !== null && (
        <span
          className={`absolute left-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-transform duration-300 ${
            isDark ? 'translate-x-[1.75rem]' : 'translate-x-0'
          }`}
        >
          {isDark ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
        </span>
      )}
    </button>
  )
}
