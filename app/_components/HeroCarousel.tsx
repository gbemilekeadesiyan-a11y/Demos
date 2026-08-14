'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { SessionVotingClient } from '@/app/sessions/[id]/_components/SessionVotingClient'
import { StatCard, SessionSummaryCard } from '@/components/SessionOverviewCards'
import {
  MESSI_RONALDO_SESSION,
  MESSI_RONALDO_OPTIONS,
  MESSI_RONALDO_RESULTS,
  MESSI_RONALDO_TOTAL_VOTES,
  MESSI_RONALDO_VOTERS,
  PIZZA_SESSION,
  PIZZA_OPTIONS,
  PIZZA_ROUNDS,
  PIZZA_RESULTS,
  PIZZA_TOTAL_VOTES,
  TEAM_WORKSPACE_STATS,
  TEAM_WORKSPACE_SESSIONS,
  FF_SESSION,
  FF_OPTIONS,
  FF_RESULTS,
  FF_TOTAL_VOTES,
  FF_VOTERS,
  FF_PAST_SESSIONS,
} from './heroCarouselMockData'

const AUTO_ADVANCE_MS = 4000
// How long the browser's own smooth-scroll to the cloned first slide takes
// to settle, roughly — after this we jump back to the real first slide
// (scrollLeft reset, no animation) so the next auto-advance keeps sliding
// left-to-right instead of animating backward across the whole track.
const SNAP_RESET_DELAY_MS = 500
// Tall enough to fit the tightest real slide (the ranked-choice leaderboard
// across 3 rounds) without cropping, with headroom to spare for the rest —
// every slide also gets its own overflow-y-auto as a safety net, since this
// was tuned by estimating rendered heights rather than measuring a browser.
const FRAME_HEIGHT = 'h-[760px]'

function MessiRonaldoSlide() {
  return (
    <SessionVotingClient
      sessionId={MESSI_RONALDO_SESSION.id}
      session={MESSI_RONALDO_SESSION}
      options={MESSI_RONALDO_OPTIONS}
      initialHasVoted
      initialShowResults
      initialResults={MESSI_RONALDO_RESULTS}
      initialTotalVotes={MESSI_RONALDO_TOTAL_VOTES}
      initialResultsLocked={false}
      initialRounds={[]}
      initialVoters={MESSI_RONALDO_VOTERS}
      workspaceType="standard"
      usingFakeData
      isAdmin={false}
      fill
      suppressPlaceholderBanner
    />
  )
}

function PizzaSlide() {
  return (
    <SessionVotingClient
      sessionId={PIZZA_SESSION.id}
      session={PIZZA_SESSION}
      options={PIZZA_OPTIONS}
      initialHasVoted
      initialShowResults
      initialResults={PIZZA_RESULTS}
      initialTotalVotes={PIZZA_TOTAL_VOTES}
      initialResultsLocked={false}
      initialRounds={PIZZA_ROUNDS}
      initialVoters={[]}
      workspaceType="standard"
      usingFakeData
      isAdmin={false}
      fill
      suppressPlaceholderBanner
    />
  )
}

// Reuses StatCard/SessionSummaryCard (components/SessionOverviewCards.tsx)
// directly — the same presentational pieces WorkspaceDashboardClient itself
// is built from. Not that container: it owns useRouter, a real signOut()
// call on its "Log out" button, and a real listSessions() fetch on every
// workspace switch — none of which belong wired up on a static marketing
// page a visitor might actually click around in.
function DashboardSlide() {
  return (
    <div className="h-full w-full overflow-y-auto bg-background px-8 py-8">
      <p className="text-xs text-muted">Workspace</p>
      <h2 className="font-heading text-2xl text-foreground">Product Team</h2>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Sessions" value={TEAM_WORKSPACE_STATS.totalSessions.toLocaleString()} />
        <StatCard label="Total Votes Cast" value={TEAM_WORKSPACE_STATS.totalVotes.toLocaleString()} />
        <StatCard label="Average Turnout" value={`${TEAM_WORKSPACE_STATS.averageTurnout}%`} />
        <StatCard label="Active Sessions" value={TEAM_WORKSPACE_STATS.activeSessions.toString()} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TEAM_WORKSPACE_SESSIONS.map((session) => (
          <SessionSummaryCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  )
}

// SessionVotingClient sits in a flex-1 wrapper rather than getting the
// slide's full height directly — flexbox gives that wrapper a definite
// computed height (what `fill` needs to resolve h-full against) while
// still leaving room below for the past-votes row.
function FfDinnerSlide() {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="min-h-0 flex-1">
        <SessionVotingClient
          sessionId={FF_SESSION.id}
          session={FF_SESSION}
          options={FF_OPTIONS}
          initialHasVoted
          initialShowResults
          initialResults={FF_RESULTS}
          initialTotalVotes={FF_TOTAL_VOTES}
          initialResultsLocked={false}
          initialRounds={[]}
          initialVoters={FF_VOTERS}
          workspaceType="ff"
          usingFakeData
          isAdmin={false}
          fill
          suppressPlaceholderBanner
        />
      </div>
      <div className="shrink-0 border-t border-fuchsia-900/20 px-6 py-5">
        <p className="mb-3 text-xs uppercase tracking-wide text-subtle">Past votes</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FF_PAST_SESSIONS.map((session) => (
            <SessionSummaryCard key={session.id} session={session} />
          ))}
        </div>
      </div>
    </div>
  )
}

const SLIDES: { id: string; label: string; Component: ComponentType }[] = [
  { id: 'messi-ronaldo', label: 'Live vote in progress', Component: MessiRonaldoSlide },
  { id: 'pizza', label: 'Ranked choice results', Component: PizzaSlide },
  { id: 'dashboard', label: 'Workspace dashboard', Component: DashboardSlide },
  { id: 'ff-dinner', label: 'F&F group', Component: FfDinnerSlide },
]

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    function onChange(e: MediaQueryListEvent) {
      setReduced(e.matches)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

// Fixed-size frame, sliding via native CSS scroll-snap rather than a
// carousel library — a cloned first slide is appended after the real last
// one so auto-advance can keep animating left-to-right through the "loop"
// instead of animating backward from the last slide to the first; landing
// on the clone silently resets scrollLeft back to the real first slide
// right after, which is invisible since the clone is pixel-identical.
export function HeroCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  // True while a scrollTo() we triggered ourselves is still in flight — a
  // *smooth* scrollTo fires a stream of intermediate 'scroll' events as it
  // animates, and without this flag the sync-from-scroll effect below would
  // treat each of those in-between positions as a real move, round it down
  // to the slide we're leaving, and call setIndex back to it — undoing the
  // advance almost as soon as it started. Cleared on a timer rather than a
  // 'scrollend' listener for wider browser support.
  const programmaticRef = useRef(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const slideCount = SLIDES.length
  const activeDot = index % slideCount

  function scrollToIndex(target: number, smooth: boolean) {
    const track = trackRef.current
    if (!track) return
    programmaticRef.current = true
    track.scrollTo({ left: target * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
    window.setTimeout(
      () => {
        programmaticRef.current = false
      },
      smooth ? 500 : 50
    )
  }

  // Drives the actual scroll position from `index`, including the
  // clone-then-reset step when index reaches the cloned slide.
  useEffect(() => {
    scrollToIndex(index, true)

    if (index === slideCount) {
      const timeout = setTimeout(() => {
        scrollToIndex(0, false)
        setIndex(0)
      }, SNAP_RESET_DELAY_MS)
      return () => clearTimeout(timeout)
    }
    // scrollToIndex only reads trackRef.current and its own arguments, so
    // it doesn't need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slideCount])

  // Auto-advance — paused on hover/touch, and disabled entirely for
  // prefers-reduced-motion rather than just sped up or skipped once.
  useEffect(() => {
    if (prefersReducedMotion || paused) return
    const id = setInterval(() => setIndex((i) => i + 1), AUTO_ADVANCE_MS)
    return () => clearInterval(id)
  }, [prefersReducedMotion, paused])

  // Keeps the dots in sync with manual swipes, which move the track
  // without going through `index` above. Ignores scroll events that fire
  // while programmaticRef is set, i.e. ones caused by our own scrollToIndex
  // rather than an actual user gesture.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let raf = 0

    function onScroll() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (programmaticRef.current || !track) return
        setIndex(Math.round(track.scrollLeft / track.clientWidth))
      })
    }

    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      track.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      id="product"
      className="relative mx-auto mt-16 w-full max-w-4xl scroll-mt-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className={`flex ${FRAME_HEIGHT} w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-2xl border border-foreground/10 bg-foreground/5 shadow-2xl backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {[...SLIDES, SLIDES[0]].map((slide, i) => (
          // These mount real, reused app components (SessionVotingClient,
          // SessionSummaryCard's Link to /sessions/[id], ...) against mock
          // data with no backing rows — this is presentational only, so
          // every click within a slide is swallowed in the capture phase
          // before it can navigate or fire a real handler (a real "Log
          // out"/vote-submit/etc. click would otherwise be one tap away).
          // Doesn't affect the swipe/scroll-snap gesture, which never
          // produces a click event in the first place.
          <div
            key={`${slide.id}-${i}`}
            className="h-full w-full shrink-0 snap-start"
            onClickCapture={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <slide.Component />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Go to slide ${i + 1}: ${slide.label}`}
            aria-current={activeDot === i}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              activeDot === i ? 'w-6 bg-accent' : 'w-1.5 bg-foreground/20 hover:bg-foreground/35'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
