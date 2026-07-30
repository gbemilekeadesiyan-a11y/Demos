'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'
import { signOut } from '@/app/(auth)/_lib/actions'
import type { UserSummary } from '@/app/(auth)/_lib/schema'

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, inView }
}

function FadeInSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}

const CAPABILITIES = [
  {
    title: 'Workspaces for teams',
    description: 'A home for your group’s decisions — public or private, member-managed.',
  },
  {
    title: 'Casual F&F polls',
    description: 'Always-public, playful voting for friend groups — no admin setup required.',
  },
  {
    title: 'Single, multiple & ranked voting',
    description: 'Pick one, pick several, or rank every option — instant runoff included.',
  },
  {
    title: 'Live results',
    description: 'Watch the count update in real time as votes come in.',
  },
  {
    title: 'Join by code',
    description: 'Enter a six-digit code and vote — no account needed.',
  },
]

const SESSION_TYPES = [
  {
    title: 'Single choice',
    description: 'Classic up-or-down polls — pick the one option that wins it for you.',
  },
  {
    title: 'Multiple choice',
    description: 'Select every option that applies. No need to pick just one.',
  },
  {
    title: 'Ranked choice',
    description: 'Rank every option top to bottom — instant runoff decides the winner.',
  },
  {
    title: 'Live results',
    description: 'Bars move as votes land, so everyone watches consensus form together.',
  },
]

function SessionTypeCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  function handleScroll() {
    const el = trackRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex(index)
  }

  function scrollToIndex(index: number) {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SESSION_TYPES.map((type) => (
          <div
            key={type.title}
            className="w-full shrink-0 snap-center rounded-2xl border border-foreground/10 bg-foreground/5 p-8 backdrop-blur-md sm:p-10"
          >
            <h3 className="font-heading text-2xl text-foreground sm:text-3xl">{type.title}</h3>
            <p className="mt-3 max-w-md text-sm text-muted">{type.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {SESSION_TYPES.map((type, index) => (
          <button
            key={type.title}
            type="button"
            onClick={() => scrollToIndex(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              activeIndex === index ? 'w-5 bg-foreground' : 'w-1.5 bg-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function displayName(user: UserSummary) {
  const fullName = `${user.firstName} ${user.lastName}`.trim()
  return fullName || user.username
}

function AccountMenu({ user }: { user: UserSummary }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm text-foreground transition hover:bg-foreground/5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-border-strong text-xs font-medium">
          {displayName(user).charAt(0).toUpperCase()}
        </span>
        {displayName(user)}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-lg border border-border bg-surface p-1 shadow-lg">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

export function LandingClient({ currentUser }: { currentUser: UserSummary | null }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      <AuraBackground />

      <div className="relative">
        <header className="flex items-center justify-between px-6 py-6 sm:px-10">
          <Link href="/" className="flex items-center">
            <Logo className="h-6 w-auto text-foreground" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {currentUser ? (
              <AccountMenu user={currentUser} />
            ) : (
              <>
                <Link href="/login" className="text-muted transition hover:text-foreground">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-foreground px-4 py-2 font-medium text-background transition hover:opacity-90"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </header>

        <section className="mx-auto max-w-3xl px-6 pt-16 text-center sm:pt-24">
          <h1 className="font-heading text-5xl text-foreground sm:text-6xl">dēmos</h1>
          <p className="mt-4 font-heading text-2xl text-muted sm:text-3xl">
            Where consensus finds its voice
          </p>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted sm:text-base">
            dēmos is a voting platform for workspaces and friend groups — create sessions, vote your
            way, and watch consensus form in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {currentUser ? (
              <Link
                href="/workspaces"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
                >
                  Sign up
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-border-strong px-6 py-3 text-sm text-muted transition hover:border-foreground/40"
                >
                  Log in
                </Link>
                <Link
                  href="/join"
                  className="rounded-full border border-border-strong px-6 py-3 text-sm text-muted transition hover:border-foreground/40"
                >
                  Join by code
                </Link>
              </>
            )}
          </div>
        </section>

        <FadeInSection className="mx-auto mt-24 max-w-5xl px-6">
          <h2 className="text-center font-heading text-2xl text-foreground sm:text-3xl">
            Everything a decision needs
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.title}
                className="rounded-2xl border border-foreground/10 bg-foreground/5 p-6 backdrop-blur-md"
              >
                <h3 className="font-heading text-lg text-foreground">{capability.title}</h3>
                <p className="mt-2 text-sm text-muted">{capability.description}</p>
              </div>
            ))}
          </div>
        </FadeInSection>

        <FadeInSection className="mx-auto mt-24 max-w-3xl px-6">
          <h2 className="text-center font-heading text-2xl text-foreground sm:text-3xl">
            Vote the way that fits
          </h2>
          <div className="mt-8">
            <SessionTypeCarousel />
          </div>
        </FadeInSection>

        {!currentUser && (
          <FadeInSection className="mx-auto mt-24 max-w-2xl px-6 pb-24 text-center">
            <h2 className="font-heading text-2xl text-foreground sm:text-3xl">Ready to decide together?</h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
              >
                Sign up
              </Link>
              <Link
                href="/join"
                className="rounded-full border border-border-strong px-6 py-3 text-sm text-muted transition hover:border-foreground/40"
              >
                Join by code
              </Link>
            </div>
          </FadeInSection>
        )}
      </div>
    </main>
  )
}
