'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RankedRound, SessionVoter, VotingSession } from '../../_lib/schema'

type ResultRow = { optionId: string; label: string; count: number }

// Our own palette, not Google Forms' default rainbow — reused across pie
// slices, bar fills, and the leaderboard's row-color dots.
const CHART_COLORS = ['#38bdf8', '#e879f9', '#fbbf24', '#34d399', '#a78bfa', '#fb7185']

// One stable color per option, shared by every view (pie/bar cells, row
// dots, leaderboard avatars) — computed once from `results`' order so an
// option's color doesn't shift between the chart and its avatar cluster, or
// across ranked-choice rounds (which reorder by count each round).
function buildOptionColors(rows: ResultRow[]): Map<string, string> {
  const map = new Map<string, string>()
  rows.forEach((row, i) => map.set(row.optionId, CHART_COLORS[i % CHART_COLORS.length]))
  return map
}

function voterName(voter: SessionVoter): string {
  if (!voter.user) return 'Anonymous'
  const name = `${voter.user.firstName} ${voter.user.lastName}`.trim()
  return name || voter.user.username
}

function voterInitial(voter: SessionVoter): string {
  return voterName(voter).charAt(0).toUpperCase()
}

// Never built for a secret session, even if `selections` were somehow
// present on the voter objects — ballot secrecy is enforced again here, not
// just trusted from what the server already omits for secret sessions (see
// listSessionVoters in app/sessions/_lib/actions.ts).
function groupVotersByOption(
  voters: SessionVoter[],
  ballotSecrecy: VotingSession['ballot_secrecy']
): Map<string, SessionVoter[]> {
  const map = new Map<string, SessionVoter[]>()
  if (ballotSecrecy !== 'open') {
    return map
  }
  for (const voter of voters) {
    for (const selection of voter.selections ?? []) {
      const list = map.get(selection.optionId) ?? []
      list.push(voter)
      map.set(selection.optionId, list)
    }
  }
  return map
}

// Ranked ballots rank every option, so "the option they chose" only has an
// unambiguous meaning for their top choice — used solely to annotate the
// leaderboard's first round (see LeaderboardView), since later rounds
// redistribute eliminated ballots and a static first-choice grouping would
// misrepresent them.
function groupVotersByFirstChoice(
  voters: SessionVoter[],
  ballotSecrecy: VotingSession['ballot_secrecy']
): Map<string, SessionVoter[]> {
  const map = new Map<string, SessionVoter[]>()
  if (ballotSecrecy !== 'open') {
    return map
  }
  for (const voter of voters) {
    const firstChoice = voter.selections?.find((selection) => selection.rank === 1)
    if (!firstChoice) continue
    const list = map.get(firstChoice.optionId) ?? []
    list.push(voter)
    map.set(firstChoice.optionId, list)
  }
  return map
}

const DEFAULT_STYLE: Record<VotingSession['vote_format'], NonNullable<VotingSession['results_style']>> = {
  single: 'pie_chart',
  multiple: 'bar_chart',
  ranked: 'leaderboard',
}

const tooltipStyle = {
  background: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'rgb(var(--foreground))',
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v3M9 20h6M10 16h4v4h-4v-4Z" />
    </svg>
  )
}

// Overlapping initials avatars for a list of voters, capped at `max` with a
// "+N" overflow badge. `color` ties the cluster to a specific option's
// chart color (per-option grouping); omitted for the plain participation
// summary, which isn't tied to any option.
function AvatarCluster({ voters, color, max = 5 }: { voters: SessionVoter[]; color?: string; max?: number }) {
  const visible = voters.slice(0, max)
  const overflow = voters.length - visible.length

  return (
    <span className="flex items-center -space-x-2">
      {visible.map((voter, i) => (
        <span
          key={voter.user?.id ?? `anon-${i}`}
          title={voterName(voter)}
          style={{ backgroundColor: color ?? 'rgb(var(--muted))' }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
        >
          {voterInitial(voter)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background bg-foreground/10 text-[10px] font-medium text-muted">
          +{overflow}
        </span>
      )}
    </span>
  )
}

function ResultRowsList({
  rows,
  totalVotes,
  optionColors,
  avatarsByOption,
}: {
  rows: ResultRow[]
  totalVotes: number
  optionColors: Map<string, string>
  avatarsByOption?: Map<string, SessionVoter[]>
}) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {rows.map((row) => {
        const pct = totalVotes > 0 ? Math.round((row.count / totalVotes) * 100) : 0
        const color = optionColors.get(row.optionId)
        const voters = avatarsByOption?.get(row.optionId) ?? []
        return (
          <div key={row.optionId} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="truncate">{row.label}</span>
              {voters.length > 0 && <AvatarCluster voters={voters} color={color} max={4} />}
            </span>
            <span className="shrink-0 text-muted">
              {row.count} · {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PieChartView({
  rows,
  totalVotes,
  optionColors,
  avatarsByOption,
}: {
  rows: ResultRow[]
  totalVotes: number
  optionColors: Map<string, string>
  avatarsByOption?: Map<string, SessionVoter[]>
}) {
  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="label"
              innerRadius={56}
              outerRadius={96}
              paddingAngle={2}
              strokeWidth={0}
            >
              {rows.map((row) => (
                <Cell key={row.optionId} fill={optionColors.get(row.optionId)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [`${value} vote${value === 1 ? '' : 's'}`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ResultRowsList rows={rows} totalVotes={totalVotes} optionColors={optionColors} avatarsByOption={avatarsByOption} />
    </div>
  )
}

function BarChartView({
  rows,
  totalVotes,
  optionColors,
  avatarsByOption,
}: {
  rows: ResultRow[]
  totalVotes: number
  optionColors: Map<string, string>
  avatarsByOption?: Map<string, SessionVoter[]>
}) {
  const height = Math.max(120, rows.length * 44)
  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="rgb(var(--divider))" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }}
              axisLine={{ stroke: 'rgb(var(--divider))' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={{ fill: 'rgb(var(--foreground))', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgb(var(--foreground) / 0.04)' }}
              contentStyle={tooltipStyle}
              formatter={(value) => [`${value} vote${value === 1 ? '' : 's'}`, 'Votes']}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {rows.map((row) => (
                <Cell key={row.optionId} fill={optionColors.get(row.optionId)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ResultRowsList rows={rows} totalVotes={totalVotes} optionColors={optionColors} avatarsByOption={avatarsByOption} />
    </div>
  )
}

// Not a Recharts chart — a ranked list of styled progress rows per IRV
// round, closer to a leaderboard widget than a plot. Options already
// eliminated in an earlier round are dropped from later rounds' lists
// entirely rather than shown at a frozen 0. Avatars (first-choice grouping)
// only ever annotate round 1 — see groupVotersByFirstChoice.
function LeaderboardView({
  rounds,
  totalVotes,
  optionColors,
  firstChoiceAvatarsByOption,
}: {
  rounds: RankedRound[]
  totalVotes: number
  optionColors: Map<string, string>
  firstChoiceAvatarsByOption: Map<string, SessionVoter[]>
}) {
  const eliminatedSoFar = new Set<string>()
  const finalRoundIndex = rounds.length - 1

  return (
    <div className="flex flex-col gap-5">
      {rounds.map((round, i) => {
        const isFinal = i === finalRoundIndex
        const visible = round.counts.filter((row) => !eliminatedSoFar.has(row.optionId))
        const roundTotal = visible.reduce((sum, row) => sum + row.count, 0)
        const sorted = [...visible].sort((a, b) => b.count - a.count)
        const winnerId = isFinal && sorted.length > 0 ? sorted[0].optionId : null
        const eliminatedLabels = round.eliminated
          .map((id) => round.counts.find((row) => row.optionId === id)?.label)
          .filter((label): label is string => Boolean(label))

        for (const id of round.eliminated) eliminatedSoFar.add(id)

        return (
          <div key={round.roundNumber}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                {isFinal ? 'Final round' : `Round ${round.roundNumber}`}
              </p>
              {eliminatedLabels.length > 0 && (
                <p className="truncate text-xs text-muted">Eliminated: {eliminatedLabels.join(', ')}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {sorted.map((row) => {
                const pct = roundTotal > 0 ? Math.round((row.count / roundTotal) * 100) : 0
                const voters = i === 0 ? (firstChoiceAvatarsByOption.get(row.optionId) ?? []) : []
                return (
                  <div key={row.optionId} className="relative overflow-hidden rounded-lg border border-border">
                    <div className="absolute inset-y-0 left-0 bg-foreground/10" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                        {row.optionId === winnerId && (
                          <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                        <span className="truncate">{row.label}</span>
                        {voters.length > 0 && (
                          <AvatarCluster voters={voters} color={optionColors.get(row.optionId)} max={3} />
                        )}
                      </span>
                      <span className="shrink-0 text-muted">
                        {row.count} · {pct}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="text-xs text-subtle">
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} total
      </p>
    </div>
  )
}

export function ResultsDisplay({
  session,
  results,
  totalVotes,
  resultsLocked,
  rounds,
  voters,
  suppressRankedBreakdown,
}: {
  session: VotingSession
  results: ResultRow[]
  totalVotes: number
  resultsLocked: boolean
  rounds: RankedRound[]
  voters: SessionVoter[]
  suppressRankedBreakdown: boolean
}) {
  if (resultsLocked) {
    return (
      <p className="mt-8 text-sm text-muted">
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · Vote to see results
      </p>
    )
  }

  // Per demos-system-design.md § 8.4: never show a live IRV leaderboard —
  // standings can flip entirely as ballots arrive and eliminations happen,
  // which can mislead voters mid-poll. Vote count only until the session
  // closes.
  if (suppressRankedBreakdown) {
    return (
      <p className="mt-8 text-sm text-muted">
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · Full ranked-choice results are revealed after voting
        closes
      </p>
    )
  }

  if (totalVotes === 0) {
    return <p className="mt-8 text-sm text-muted">No votes yet.</p>
  }

  const style = session.results_style ?? DEFAULT_STYLE[session.vote_format]
  const optionColors = buildOptionColors(results)

  // Participation (who voted) is always safe to show, secret or open — it's
  // the option-level grouping below that's gated on ballot_secrecy.
  const avatarsByOption = groupVotersByOption(voters, session.ballot_secrecy)
  const firstChoiceAvatarsByOption = groupVotersByFirstChoice(voters, session.ballot_secrecy)

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {totalVotes} {totalVotes === 1 ? 'person has' : 'people have'} voted
        </p>
        {voters.length > 0 && <AvatarCluster voters={voters} max={6} />}
      </div>
      {style === 'pie_chart' && (
        <PieChartView rows={results} totalVotes={totalVotes} optionColors={optionColors} avatarsByOption={avatarsByOption} />
      )}
      {style === 'bar_chart' && (
        <BarChartView rows={results} totalVotes={totalVotes} optionColors={optionColors} avatarsByOption={avatarsByOption} />
      )}
      {style === 'leaderboard' && (
        <LeaderboardView
          rounds={rounds.length > 0 ? rounds : [{ roundNumber: 1, counts: results, eliminated: [] }]}
          totalVotes={totalVotes}
          optionColors={optionColors}
          firstChoiceAvatarsByOption={firstChoiceAvatarsByOption}
        />
      )}
    </div>
  )
}
