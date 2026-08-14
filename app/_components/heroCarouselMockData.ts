import type { SessionCardData } from '@/components/SessionOverviewCards'
import type { RankedRound, SessionOption, SessionVoter, VotingSession } from '@/app/sessions/_lib/schema'

type ResultRow = { optionId: string; label: string; count: number }

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString()
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

// Slide 1 — a close, single-choice vote already showing results.
export const MESSI_RONALDO_SESSION: VotingSession = {
  id: 'mock-messi-ronaldo',
  workspace_id: 'mock-workspace-sports',
  title: 'Messi or Ronaldo?',
  description: 'The debate that never ends.',
  vote_format: 'single',
  visibility: 'public',
  status: 'open',
  who_can_vote: 'all_members',
  allow_anonymous_vote: true,
  // Not 'live' — keeps SessionVotingClient's realtime-subscription effect
  // skipped regardless of the usingFakeData check it's also gated behind
  // (see fill/suppressPlaceholderBanner comments in SessionVotingClient.tsx).
  results_visibility: 'hidden_until_close',
  results_style: 'bar_chart',
  ballot_secrecy: 'open',
  start_time: null,
  end_time: null,
  createdBy: { id: 'mock-user-carlos', username: 'carlos.m', firstName: 'Carlos', lastName: 'M.' },
  created_at: hoursAgo(6),
}

export const MESSI_RONALDO_OPTIONS: SessionOption[] = [
  { id: 'mock-messi', session_id: 'mock-messi-ronaldo', label: 'Messi', description: null, image_url: null },
  { id: 'mock-ronaldo', session_id: 'mock-messi-ronaldo', label: 'Ronaldo', description: null, image_url: null },
]

// 649/1247 = 52.04% → 52%, 598/1247 = 47.95% → 48%.
export const MESSI_RONALDO_RESULTS: ResultRow[] = [
  { optionId: 'mock-messi', label: 'Messi', count: 649 },
  { optionId: 'mock-ronaldo', label: 'Ronaldo', count: 598 },
]
export const MESSI_RONALDO_TOTAL_VOTES = 1247

// A representative handful, not all 1,247 — same pattern as the app's own
// buildFakeVoters (app/sessions/[id]/page.tsx): enough to populate the
// avatar clusters, not a literal one-row-per-voter reconstruction.
export const MESSI_RONALDO_VOTERS: SessionVoter[] = [
  { user: { id: 'mock-v1', username: 'diego.r', firstName: 'Diego', lastName: 'R.' }, votedAt: hoursAgo(1), selections: [{ optionId: 'mock-messi' }] },
  { user: { id: 'mock-v2', username: 'sofia.l', firstName: 'Sofia', lastName: 'L.' }, votedAt: hoursAgo(2), selections: [{ optionId: 'mock-ronaldo' }] },
  { user: { id: 'mock-v3', username: 'noah.k', firstName: 'Noah', lastName: 'K.' }, votedAt: hoursAgo(3), selections: [{ optionId: 'mock-messi' }] },
  { user: { id: 'mock-v4', username: 'mia.t', firstName: 'Mia', lastName: 'T.' }, votedAt: hoursAgo(4), selections: [{ optionId: 'mock-messi' }] },
  { user: { id: 'mock-v5', username: 'ravi.p', firstName: 'Ravi', lastName: 'P.' }, votedAt: hoursAgo(5), selections: [{ optionId: 'mock-ronaldo' }] },
  { user: { id: 'mock-v6', username: 'ella.n', firstName: 'Ella', lastName: 'N.' }, votedAt: hoursAgo(6), selections: [{ optionId: 'mock-ronaldo' }] },
]

// Slide 2 — ranked-choice, fully closed out so the IRV leaderboard (which
// SessionVotingClient otherwise suppresses while a ranked session is still
// 'open', per demos-system-design.md § 8.4) actually renders.
export const PIZZA_SESSION: VotingSession = {
  id: 'mock-pizza-topping',
  workspace_id: 'mock-workspace-team',
  title: 'Best pizza topping',
  description: 'For the office party order.',
  vote_format: 'ranked',
  visibility: 'private',
  status: 'results_released',
  who_can_vote: 'all_members',
  allow_anonymous_vote: false,
  results_visibility: 'after_you_vote',
  results_style: 'leaderboard',
  ballot_secrecy: 'secret',
  start_time: null,
  end_time: null,
  createdBy: { id: 'mock-user-priya', username: 'priya.raman', firstName: 'Priya', lastName: 'Raman' },
  created_at: daysAgo(2),
}

export const PIZZA_OPTIONS: SessionOption[] = [
  { id: 'mock-pepperoni', session_id: 'mock-pizza-topping', label: 'Pepperoni', description: null, image_url: null },
  { id: 'mock-mushroom', session_id: 'mock-pizza-topping', label: 'Mushroom', description: null, image_url: null },
  { id: 'mock-pineapple', session_id: 'mock-pizza-topping', label: 'Pineapple', description: null, image_url: null },
  { id: 'mock-bbq-chicken', session_id: 'mock-pizza-topping', label: 'BBQ Chicken', description: null, image_url: null },
]

// Three-round IRV, each round's totals summing to 89 as eliminated
// ballots redistribute — Pineapple eliminated round 1, Mushroom round 2,
// Pepperoni wins round 3 with a majority.
export const PIZZA_ROUNDS: RankedRound[] = [
  {
    roundNumber: 1,
    counts: [
      { optionId: 'mock-pepperoni', label: 'Pepperoni', count: 34 },
      { optionId: 'mock-bbq-chicken', label: 'BBQ Chicken', count: 26 },
      { optionId: 'mock-mushroom', label: 'Mushroom', count: 18 },
      { optionId: 'mock-pineapple', label: 'Pineapple', count: 11 },
    ],
    eliminated: ['mock-pineapple'],
  },
  {
    roundNumber: 2,
    counts: [
      { optionId: 'mock-pepperoni', label: 'Pepperoni', count: 39 },
      { optionId: 'mock-bbq-chicken', label: 'BBQ Chicken', count: 31 },
      { optionId: 'mock-mushroom', label: 'Mushroom', count: 19 },
    ],
    eliminated: ['mock-mushroom'],
  },
  {
    roundNumber: 3,
    counts: [
      { optionId: 'mock-pepperoni', label: 'Pepperoni', count: 52 },
      { optionId: 'mock-bbq-chicken', label: 'BBQ Chicken', count: 37 },
    ],
    eliminated: [],
  },
]

export const PIZZA_TOTAL_VOTES = 89
export const PIZZA_RESULTS: ResultRow[] = PIZZA_ROUNDS[2].counts

// Slide 3 — a team workspace dashboard: StatCard row + SessionSummaryCard
// grid, both from components/SessionOverviewCards.tsx (the same
// presentational pieces WorkspaceDashboardClient itself is built from —
// not that container, which owns useRouter/a real signOut()/live
// listSessions() fetches on workspace switch, none of which belong on a
// static marketing page).
export const TEAM_WORKSPACE_STATS = {
  totalSessions: 17,
  totalVotes: 1842,
  averageTurnout: 68.4,
  activeSessions: 3,
}

export const TEAM_WORKSPACE_SESSIONS: SessionCardData[] = [
  {
    id: 'mock-dash-1',
    title: 'Q3 offsite location',
    description: 'Where should we go this year?',
    status: 'open',
    lastActivity: minutesAgo(23),
    voteCount: 34,
    turnoutPct: 71,
  },
  {
    id: 'mock-dash-2',
    title: 'New logo direction',
    description: 'Pick your favorite concept.',
    status: 'open',
    lastActivity: minutesAgo(52),
    voteCount: 19,
    turnoutPct: 54,
  },
  {
    id: 'mock-dash-3',
    title: 'Office snack budget',
    description: null,
    status: 'open',
    lastActivity: minutesAgo(9),
    voteCount: 12,
    turnoutPct: 46,
  },
  {
    id: 'mock-dash-4',
    title: 'Standup time change',
    description: '9:30 vs 10am.',
    status: 'closed',
    lastActivity: daysAgo(1),
    voteCount: 27,
    turnoutPct: 90,
  },
  {
    id: 'mock-dash-5',
    title: 'Q2 hiring priorities',
    description: null,
    status: 'closed',
    lastActivity: daysAgo(6),
    voteCount: 41,
    turnoutPct: 83,
  },
]

// Slide 4 — F&F treatment: casual single-choice with avatar clusters, plus
// a few past votes (SessionSummaryCard again) below it.
export const FF_SESSION: VotingSession = {
  id: 'mock-ff-dinner',
  workspace_id: 'mock-ff-group',
  title: 'Where are we eating Friday?',
  description: null,
  vote_format: 'single',
  visibility: 'public',
  status: 'open',
  who_can_vote: 'all_members',
  allow_anonymous_vote: true,
  results_visibility: 'hidden_until_close',
  results_style: null,
  ballot_secrecy: 'open',
  start_time: null,
  end_time: null,
  createdBy: { id: 'mock-user-jamie', username: 'jamie', firstName: 'Jamie', lastName: '' },
  created_at: hoursAgo(3),
}

export const FF_OPTIONS: SessionOption[] = [
  { id: 'mock-tacos', session_id: 'mock-ff-dinner', label: 'Tacos', description: null, image_url: null },
  { id: 'mock-sushi', session_id: 'mock-ff-dinner', label: 'Sushi', description: null, image_url: null },
  { id: 'mock-pizza-ff', session_id: 'mock-ff-dinner', label: 'Pizza', description: null, image_url: null },
  { id: 'mock-thai', session_id: 'mock-ff-dinner', label: 'Thai', description: null, image_url: null },
]

export const FF_RESULTS: ResultRow[] = [
  { optionId: 'mock-tacos', label: 'Tacos', count: 9 },
  { optionId: 'mock-sushi', label: 'Sushi', count: 7 },
  { optionId: 'mock-pizza-ff', label: 'Pizza', count: 5 },
  { optionId: 'mock-thai', label: 'Thai', count: 2 },
]
export const FF_TOTAL_VOTES = 23

export const FF_VOTERS: SessionVoter[] = [
  { user: { id: 'mock-ff-v1', username: 'jamie', firstName: 'Jamie', lastName: '' }, votedAt: hoursAgo(3), selections: [{ optionId: 'mock-tacos' }] },
  { user: { id: 'mock-ff-v2', username: 'lena', firstName: 'Lena', lastName: '' }, votedAt: hoursAgo(2), selections: [{ optionId: 'mock-sushi' }] },
  { user: { id: 'mock-ff-v3', username: 'theo', firstName: 'Theo', lastName: '' }, votedAt: hoursAgo(2), selections: [{ optionId: 'mock-tacos' }] },
  { user: { id: 'mock-ff-v4', username: 'aya', firstName: 'Aya', lastName: '' }, votedAt: hoursAgo(1), selections: [{ optionId: 'mock-pizza-ff' }] },
  { user: { id: 'mock-ff-v5', username: 'sam', firstName: 'Sam', lastName: '' }, votedAt: minutesAgo(40), selections: [{ optionId: 'mock-thai' }] },
]

export const FF_PAST_SESSIONS: SessionCardData[] = [
  { id: 'mock-ff-past-1', title: 'Movie night pick', description: null, status: 'closed', lastActivity: daysAgo(4), voteCount: 8, turnoutPct: 80 },
  { id: 'mock-ff-past-2', title: 'Beach day or hike?', description: null, status: 'closed', lastActivity: daysAgo(9), voteCount: 11, turnoutPct: 92 },
  { id: 'mock-ff-past-3', title: 'Taco Tuesday spot', description: null, status: 'closed', lastActivity: daysAgo(16), voteCount: 6, turnoutPct: 60 },
]
