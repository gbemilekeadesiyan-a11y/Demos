'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { AuraBackground } from '@/components/AuraBackground'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Wordmark } from '@/components/Wordmark'
import type { UserSummary } from '@/app/(auth)/_lib/schema'

// In-page anchors, not separate routes — Product jumps to the screenshot in
// the hero, Use Cases to the "How it works" walkthrough, About to the
// footer. Pricing is gone; there's nothing to point it at yet.
const NAV_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#how-it-works', label: 'Use Cases' },
  { href: '#footer', label: 'About' },
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

// Small uppercase, letter-spaced label in the theme accent (blue in dark
// mode, orange in light — driven by --accent, never hardcoded) that sits
// above every major section's heading, modeled on taxo.ai's section labels.
function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs font-semibold uppercase tracking-[0.2em] text-accent ${className}`}>{children}</p>
}

// Eyebrow + two-tone heading + optional description, centered — the
// repeated header block for each of the six major sections.
function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: ReactNode
  description?: string
}) {
  return (
    <FadeInSection className="mx-auto max-w-2xl px-6 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 font-heading text-3xl text-foreground sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-sm text-muted sm:text-base">{description}</p>}
    </FadeInSection>
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
              <span aria-hidden className="text-accent">
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
    <FadeInSection className="mx-auto max-w-5xl px-6">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div className={reverse ? 'md:order-2' : undefined}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h3 className="mt-3 font-heading text-2xl text-foreground sm:text-3xl">{title}</h3>
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

// Honest, structural facts about the product itself — not fabricated usage
// metrics (no real user/customer counts exist yet to report).
const STATS = [
  {
    value: 3,
    suffix: '',
    label: 'Voting formats',
    description: 'Single, multiple, and ranked choice — with instant-runoff tallying built in.',
  },
  {
    value: 100,
    suffix: '%',
    label: 'Free to use',
    description: 'No credit card, no paid tier. dēmos is free.',
  },
  {
    value: 60,
    suffix: 's',
    label: 'To launch a session',
    description: 'Ask a question, add your options, and open the vote in under a minute.',
  },
]

// rAF-driven ease-out count from 0 to `target`, starting only once `active`
// flips true (driven by the section's IntersectionObserver below) — so it
// plays when scrolled into view, not on mount.
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return

    let frame: number
    let start: number | null = null

    function tick(timestamp: number) {
      if (start === null) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, target, duration])

  return value
}

function StatCounter({
  value,
  suffix,
  label,
  description,
  active,
}: (typeof STATS)[number] & { active: boolean }) {
  const count = useCountUp(value, active)

  return (
    <div className="text-center sm:text-left">
      <p className="font-heading text-4xl text-foreground sm:text-5xl">
        {count}
        <span className="text-accent">{suffix}</span>
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  )
}

function StatsSection() {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <div ref={ref} className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-10 px-6 sm:grid-cols-3">
      {STATS.map((stat) => (
        <StatCounter key={stat.label} {...stat} active={inView} />
      ))}
    </div>
  )
}

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
    <div className="mx-auto mt-12 flex max-w-2xl flex-col gap-2 px-6">
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
                className={`shrink-0 text-lg transition-transform duration-200 ${
                  open ? 'rotate-45 text-accent' : 'text-muted'
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
    links: [
      { href: 'mailto:gbemilekeadesiyan@gmail.com', label: 'gbemilekeadesiyan@gmail.com' },
      { href: 'mailto:gabrielmasheke@gmail.com', label: 'gabrielmasheke@gmail.com' },
    ],
  },
  // Social column removed for now — no real accounts to link to yet.
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
    <footer id="footer" className="scroll-mt-20 border-t border-divider px-6 pb-8 pt-16 sm:px-10">
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

          <div className="grid grid-cols-2 gap-8 text-xs">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <p className="text-xs uppercase tracking-wide text-subtle">{column.heading}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-muted transition hover:text-accent">
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
                  <Link key={link.href} href={link.href} className="transition hover:text-accent">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <ThemeToggle />
              {currentUser ? (
                <HeaderAvatar user={currentUser} />
              ) : (
                <>
                  <Link href="/login" className="text-muted transition hover:text-accent">
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-full bg-accent px-4 py-2 font-medium text-accent-foreground transition hover:opacity-90"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Hero — not in the labelled-section list below, so no eyebrow;
            heading stays plain foreground (no two-tone), accent kept on the
            primary CTA. */}
        <section className="mx-auto max-w-4xl px-6 pb-24 pt-20 text-center sm:pb-32 sm:pt-28">
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
                className="rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
                >
                  Get Started Free
                </Link>
                <Link href="/join" className="text-xs text-muted underline transition hover:text-accent">
                  Have a code? Join without an account
                </Link>
              </>
            )}
          </div>

          {/* TODO: replace with a real product screenshot (recommend ~2400x1500, 16:10) */}
          <div
            id="product"
            className="relative mx-auto mt-16 aspect-[16/10] w-full max-w-4xl scroll-mt-24 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/5 shadow-2xl backdrop-blur-md"
          >
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-subtle">Product screenshot coming soon</p>
            </div>
          </div>
        </section>

        <ProofStrip />

        {/* Introduction */}
        <section className="py-24 sm:py-32">
          <SectionIntro
            eyebrow="Introduction"
            title="dēmos is built differently"
            description="One place to propose, vote, and see results — with a record that sticks, for teams and friend groups alike."
          />

          <FadeInSection className="mx-auto mt-16 max-w-5xl px-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 backdrop-blur-md">
                <Eyebrow>The problem</Eyebrow>
                <h3 className="mt-3 font-heading text-2xl text-foreground sm:text-3xl">
                  Group decisions are messy
                </h3>
                <p className="mt-3 text-sm text-muted">
                  Endless threads, buried polls, no record of who decided what. By the time everyone&apos;s
                  weighed in, nobody remembers why.
                </p>
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 backdrop-blur-md">
                <Eyebrow>The dēmos way</Eyebrow>
                <h3 className="mt-3 font-heading text-2xl text-foreground sm:text-3xl">
                  One place, start to finish
                </h3>
                <p className="mt-3 text-sm text-muted">
                  Propose, vote, and see results — with a record that sticks, for teams and friend groups
                  alike.
                </p>
              </div>
            </div>
          </FadeInSection>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 py-24 sm:py-32">
          <SectionIntro
            eyebrow="How it works"
            title="From question to decision in minutes"
          />

          <div className="mt-16 flex flex-col gap-24">
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
                <div className="rounded-full border border-accent bg-accent px-4 py-2 text-xs text-accent-foreground">
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
                    <div className="absolute inset-y-0 left-0 bg-accent opacity-80" style={{ width: `${row.pct}%` }} />
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
          </div>
        </section>

        {/* Features */}
        <section className="py-24 sm:py-32">
          <SectionIntro
            eyebrow="Features"
            title="Everything you need to decide together"
          />

          <FadeInSection className="mx-auto mt-16 max-w-5xl px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {BENEFITS.map(({ Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-foreground/10 bg-foreground/5 p-6 backdrop-blur-md"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
                    <Icon />
                  </div>
                  <h3 className="mt-4 font-heading text-lg text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted">{description}</p>
                </div>
              ))}
            </div>
          </FadeInSection>
        </section>

        {/* Numbers */}
        <section className="py-24 sm:py-32">
          <SectionIntro
            eyebrow="Numbers"
            title="dēmos in numbers"
          />
          <StatsSection />
        </section>

        {/* FAQ */}
        <section className="py-24 sm:py-32">
          <SectionIntro
            eyebrow="FAQ"
            title="Frequently asked questions"
          />
          <FaqAccordion />
        </section>

        {/* Get started */}
        {!currentUser && (
          <section className="py-24 pb-32 sm:py-32 sm:pb-40">
            <FadeInSection className="mx-auto max-w-2xl px-6 text-center">
              <Eyebrow>Get started</Eyebrow>
              <h2 className="mt-3 font-heading text-3xl text-foreground sm:text-4xl">
                Ready to <span className="text-accent">decide together</span>?
              </h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
                >
                  Sign up
                </Link>
                <Link
                  href="/join"
                  className="rounded-full border border-border-strong px-6 py-3 text-sm text-muted transition hover:border-accent hover:text-accent"
                >
                  Join by code
                </Link>
              </div>
            </FadeInSection>
          </section>
        )}

        <Footer />
      </div>
    </main>
  )
}
