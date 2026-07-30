'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { AuraBackground } from '@/components/AuraBackground'
import { Wordmark } from '@/components/Wordmark'
import type { UserSummary } from '@/app/(auth)/_lib/schema'

const NAV_LINKS = [
  { href: '/product', label: 'Product' },
  { href: '/use-cases', label: 'Use Cases' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
]

function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrolled
}

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

function displayName(user: UserSummary) {
  const fullName = `${user.firstName} ${user.lastName}`.trim()
  return fullName || user.username
}

function HeaderAvatar({ user }: { user: UserSummary }) {
  return (
    <Link
      href="/workspaces"
      aria-label="Go to dashboard"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-border-strong text-xs font-medium text-foreground transition hover:opacity-90"
    >
      {displayName(user).charAt(0).toUpperCase()}
    </Link>
  )
}

const PROOF_ITEMS = ['Free to start', 'No credit card', 'Guest voting built in', 'Live results', 'Setup in minutes']

function ProofStrip() {
  return (
    <div className="border-y border-divider bg-surface/40 py-4">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6 text-xs text-muted">
        {PROOF_ITEMS.map((item, index) => (
          <span key={item} className="flex items-center gap-3">
            {index > 0 && (
              <span aria-hidden className="text-subtle">
                ·
              </span>
            )}
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconBarChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const BENEFITS = [
  {
    Icon: IconLayers,
    title: 'One home per group',
    description: 'Workspaces for teams, always-public F&F mode for friend groups.',
  },
  {
    Icon: IconCheckCircle,
    title: 'Vote your way',
    description: 'Single choice, multiple choice, or ranked choice with instant-runoff tallying.',
  },
  {
    Icon: IconBarChart,
    title: 'Watch it resolve',
    description: 'Live results stream in as votes are cast, so consensus is visible, not just announced.',
  },
]

function FeatureSection({
  eyebrow,
  title,
  description,
  reverse = false,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  reverse?: boolean
  children: ReactNode
}) {
  return (
    <FadeInSection className="mx-auto mt-24 max-w-5xl px-6">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div className={reverse ? 'md:order-2' : undefined}>
          <p className="text-xs uppercase tracking-wide text-subtle">{eyebrow}</p>
          <h2 className="mt-3 font-heading text-2xl text-foreground sm:text-3xl">{title}</h2>
          <p className="mt-3 text-sm text-muted">{description}</p>
        </div>
        <div
          className={`rounded-2xl border border-foreground/10 bg-foreground/5 p-6 backdrop-blur-md ${
            reverse ? 'md:order-1' : ''
          }`}
        >
          {children}
        </div>
      </div>
    </FadeInSection>
  )
}

const RESULTS_MOCK = [
  { label: 'A New Place!', pct: 47 },
  { label: 'Regular Spot', pct: 34 },
  { label: 'At the Office', pct: 19 },
]

const FAQ_ITEMS = [
  {
    q: 'Do voters need an account?',
    a: 'No — public sessions support guest voting. Anyone with the link or a six-digit code can vote without signing up.',
  },
  {
    q: 'What voting formats are supported?',
    a: 'Single choice, multiple choice, and ranked choice with instant-runoff tallying.',
  },
  {
    q: 'Can I keep results hidden until voting closes?',
    a: 'Yes. Each session controls whether results are hidden until close, shown live, or revealed after you vote.',
  },
  {
    q: "What's the difference between a workspace and F&F mode?",
    a: 'Workspaces are admin-controlled and can be public or private. F&F workspaces are always public and built for casual friend-group polls.',
  },
  {
    q: 'Is dēmos free?',
    a: 'Yes, dēmos is free to use.',
  },
]

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-2">
      {FAQ_ITEMS.map((item, index) => {
        const open = openIndex === index
        return (
          <div key={item.q} className="rounded-xl border border-foreground/10 bg-foreground/5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm text-foreground"
            >
              {item.q}
              <span
                aria-hidden
                className={`shrink-0 text-lg text-muted transition-transform duration-200 ${
                  open ? 'rotate-45' : ''
                }`}
              >
                +
              </span>
            </button>
            {open && <p className="px-5 pb-4 text-sm text-muted">{item.a}</p>}
          </div>
        )
      })}
    </div>
  )
}

const FOOTER_COLUMNS = [
  {
    heading: 'Information',
    links: NAV_LINKS,
  },
  {
    heading: 'Contact',
    // Placeholder address — no real inbox behind this yet.
    links: [{ href: 'mailto:hello@demos.app', label: 'hello@demos.app' }],
  },
  {
    heading: 'Social',
    // Not wired to real accounts yet — '#' rather than a fabricated URL.
    links: [
      { href: '#', label: 'X' },
      { href: '#', label: 'GitHub' },
      { href: '#', label: 'LinkedIn' },
    ],
  },
]

function Footer() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  function handleSubscribe(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Front-end only — no newsletter backend wired up yet.
    setSubscribed(true)
  }

  return (
    <footer className="border-t border-divider px-6 pb-8 pt-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="text-sm text-foreground">Stay in the loop</p>
            <p className="mt-1 text-xs text-muted">Occasional updates when we ship something new. No spam.</p>
            {subscribed ? (
              <p className="mt-3 text-xs text-muted">Thanks — we&apos;ll be in touch.</p>
            ) : (
              <form onSubmit={handleSubscribe} className="mt-3 flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full border border-border bg-surface/80 px-4 py-2 text-xs text-foreground placeholder-muted outline-none focus:border-border-strong"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition hover:opacity-90"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>

          <div className="grid grid-cols-3 gap-8 text-xs">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <p className="text-xs uppercase tracking-wide text-subtle">{column.heading}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-muted transition hover:text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 overflow-hidden">
          <Wordmark className="h-16 w-auto text-foreground sm:h-24" />
        </div>

        <div className="mt-8 border-t border-divider pt-6 text-xs text-subtle">
          <p>© {new Date().getFullYear()} dēmos. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export function LandingClient({ currentUser }: { currentUser: UserSummary | null }) {
  const scrolled = useScrolled()

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      <AuraBackground />

      <div className="relative">
        <header
          className={`sticky top-0 z-40 transition-colors duration-300 ${
            scrolled
              ? 'border-b border-divider bg-background/70 shadow-sm backdrop-blur-md'
              : 'border-b border-transparent bg-transparent'
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center">
                <Wordmark className="h-4 w-auto text-foreground" />
              </Link>
              <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="transition hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-4 text-sm">
              {currentUser ? (
                <HeaderAvatar user={currentUser} />
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
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-16 text-center sm:pt-24">
          <h1 className="font-heading text-5xl leading-[1.05] text-foreground sm:text-6xl">
            Where consensus
            <br />
            finds its voice
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted sm:text-base">
            Create a session, vote your way, and watch the decision form in real time.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            {currentUser ? (
              <Link
                href="/workspaces"
                className="rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background transition hover:opacity-90"
                >
                  Get Started Free
                </Link>
                <Link href="/join" className="text-xs text-muted underline transition hover:text-foreground">
                  Have a code? Join without an account
                </Link>
              </>
            )}
          </div>

          {/* TODO: replace with a real product screenshot (recommend ~2400x1500, 16:10) */}
          <div className="relative mx-auto mt-16 aspect-[16/10] w-full max-w-4xl overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/5 shadow-2xl backdrop-blur-md">
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-subtle">Product screenshot coming soon</p>
            </div>
          </div>
        </section>

        <div className="mt-16">
          <ProofStrip />
        </div>

        {/* Problem / solution */}
        <FadeInSection className="mx-auto mt-24 max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 backdrop-blur-md">
              <p className="text-xs uppercase tracking-wide text-subtle">The problem</p>
              <h2 className="mt-3 font-heading text-2xl text-foreground sm:text-3xl">Group decisions are messy</h2>
              <p className="mt-3 text-sm text-muted">
                Endless threads, buried polls, no record of who decided what. By the time everyone&apos;s
                weighed in, nobody remembers why.
              </p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 backdrop-blur-md">
              <p className="text-xs uppercase tracking-wide text-subtle">The dēmos way</p>
              <h2 className="mt-3 font-heading text-2xl text-foreground sm:text-3xl">
                dēmos is built differently
              </h2>
              <p className="mt-3 text-sm text-muted">
                One place to propose, vote, and see results — with a record that sticks, for teams and
                friend groups alike.
              </p>
            </div>
          </div>
        </FadeInSection>

        {/* Benefit cards */}
        <FadeInSection className="mx-auto mt-24 max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {BENEFITS.map(({ Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-foreground/10 bg-foreground/5 p-6 backdrop-blur-md"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 text-foreground">
                  <Icon />
                </div>
                <h3 className="mt-4 font-heading text-lg text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted">{description}</p>
              </div>
            ))}
          </div>
        </FadeInSection>

        {/* Alternating feature sections */}
        <FeatureSection
          eyebrow="Workspaces"
          title="A home for every group's decisions"
          description="Create a workspace for your team or friend group, invite people by link or code, and keep every session in one place."
        >
          <div className="flex flex-col gap-2">
            <div className="rounded-lg bg-foreground/10 px-3 py-2 text-xs text-foreground">Design Team</div>
            <div className="rounded-lg px-3 py-2 text-xs text-muted">Product Weekly</div>
            <div className="rounded-lg px-3 py-2 text-xs text-muted">Friday Night Crew</div>
          </div>
        </FeatureSection>

        <FeatureSection
          eyebrow="Voting formats"
          title="Pick one, pick several, or rank them all"
          description="Single choice, multiple choice, and ranked choice with instant-runoff tallying — the format fits the decision, not the other way around."
          reverse
        >
          <div className="flex flex-col gap-2">
            <div className="rounded-full border border-foreground bg-foreground px-4 py-2 text-xs text-background">
              A New Place!
            </div>
            <div className="rounded-full border border-foreground/20 px-4 py-2 text-xs text-muted">
              At the Office
            </div>
            <div className="rounded-full border border-foreground/20 px-4 py-2 text-xs text-muted">
              Regular Spot
            </div>
          </div>
        </FeatureSection>

        <FeatureSection
          eyebrow="Live results"
          title="Watch consensus form in real time"
          description="Bars update as votes are cast, so everyone can see the decision take shape — not just the final tally."
        >
          <div className="flex flex-col gap-2">
            {RESULTS_MOCK.map((row) => (
              <div key={row.label} className="relative overflow-hidden rounded-full border border-foreground/10">
                <div
                  className="absolute inset-y-0 left-0 bg-foreground opacity-80"
                  style={{ width: `${row.pct}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2 text-xs text-foreground">
                  <span>{row.label}</span>
                  <span className="text-muted">{row.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </FeatureSection>

        <FeatureSection
          eyebrow="Join by code"
          title="No account, no friction"
          description="Share a six-digit code and let anyone vote instantly — perfect for casual polls where signing up would just get in the way."
          reverse
        >
          <div className="flex items-center justify-center gap-2">
            {['E', '5', '1', '9', '0', '2'].map((digit, index) => (
              <div
                key={index}
                className="flex h-10 w-8 items-center justify-center rounded-lg border border-foreground/20 text-sm text-foreground"
              >
                {digit}
              </div>
            ))}
          </div>
        </FeatureSection>

        {/* FAQ */}
        <FadeInSection className="mx-auto mt-24 max-w-2xl px-6">
          <h2 className="text-center font-heading text-2xl text-foreground sm:text-3xl">
            Frequently asked questions
          </h2>
          <FaqAccordion />
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

        <Footer />
      </div>
    </main>
  )
}
