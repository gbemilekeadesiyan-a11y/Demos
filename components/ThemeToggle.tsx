'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle({ className }: { className?: string }) {
  // Unknown until mount — the real state lives on <html class="dark">,
  // set synchronously by the inline script in app/layout.tsx before this
  // component ever renders, so reading it here (not re-deriving from
  // localStorage/matchMedia) is what keeps this in sync with that script.
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
      className={className}
    >
      {isDark === null ? null : isDark ? '☀️' : '🌙'}
    </button>
  )
}
