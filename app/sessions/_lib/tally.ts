import type { RankedRound } from './schema'

// Pure tallying logic, split out of actions.ts (which is 'use server' —
// every export there compiles into an async server action, which a sync
// function like these can't be) so it can be unit tested directly.

export function tallySimpleChoice(
  options: { id: string; label: string }[],
  selections: { option_id: string }[]
): { optionId: string; label: string; count: number }[] {
  const counts = new Map(options.map((option) => [option.id, 0]))

  for (const selection of selections) {
    counts.set(selection.option_id, (counts.get(selection.option_id) ?? 0) + 1)
  }

  return options.map((option) => ({
    optionId: option.id,
    label: option.label,
    count: counts.get(option.id) ?? 0,
  }))
}

// Instant Runoff Voting, per demos-system-design.md § 8.3: tally first
// choices, eliminate the lowest, redistribute those ballots to their
// next-ranked remaining option, repeat until majority. Two behaviors the
// design doc doesn't spell out, decided here:
// - A ballot with no remaining ranked option left ("exhausted") is dropped
//   from that round's count and from the majority denominator, rather than
//   counted for no one — standard IRV practice.
// - A tie for lowest eliminates all tied options in the same round, rather
//   than picking one arbitrarily.
// `finalCounts` is each option's tally in the last round it was still
// standing (0 once eliminated). `rounds` is the same loop's per-iteration
// history — one entry per round, `eliminated` empty on the round that ended
// the loop (majority, one option left, or a full tie) — added for the
// results leaderboard without changing the elimination/majority logic
// itself, which is unchanged from before this was added.
export function tallyRankedChoice(
  options: { id: string; label: string }[],
  selections: { option_id: string; rank: number | null; vote_id: string }[]
): {
  finalCounts: { optionId: string; label: string; count: number }[]
  rounds: RankedRound[]
} {
  const ballots = new Map<string, { optionId: string; rank: number }[]>()

  for (const selection of selections) {
    if (selection.rank === null) continue
    const ballot = ballots.get(selection.vote_id) ?? []
    ballot.push({ optionId: selection.option_id, rank: selection.rank })
    ballots.set(selection.vote_id, ballot)
  }

  for (const ballot of ballots.values()) {
    ballot.sort((a, b) => a.rank - b.rank)
  }

  const remaining = new Set(options.map((option) => option.id))
  const finalCounts = new Map(options.map((option) => [option.id, 0]))
  const rounds: RankedRound[] = []

  function recordRound(roundCounts: Map<string, number>, eliminated: string[]) {
    rounds.push({
      roundNumber: rounds.length + 1,
      counts: options.map((option) => ({
        optionId: option.id,
        label: option.label,
        count: roundCounts.get(option.id) ?? 0,
      })),
      eliminated,
    })
  }

  while (remaining.size > 0) {
    const roundCounts = new Map<string, number>()
    for (const id of remaining) roundCounts.set(id, 0)

    let countedBallots = 0

    for (const ballot of ballots.values()) {
      const firstRemaining = ballot.find((choice) => remaining.has(choice.optionId))
      if (!firstRemaining) continue
      roundCounts.set(firstRemaining.optionId, (roundCounts.get(firstRemaining.optionId) ?? 0) + 1)
      countedBallots += 1
    }

    for (const [id, count] of roundCounts) {
      finalCounts.set(id, count)
    }

    const majorityThreshold = countedBallots / 2
    const hasMajority = [...roundCounts.values()].some((count) => count > majorityThreshold)

    if (hasMajority || remaining.size === 1) {
      recordRound(roundCounts, [])
      break
    }

    const lowestCount = Math.min(...roundCounts.values())
    const toEliminate = [...roundCounts.entries()]
      .filter(([, count]) => count === lowestCount)
      .map(([id]) => id)

    for (const id of toEliminate) {
      remaining.delete(id)
    }

    if (remaining.size === 0) {
      // Every remaining option tied for lowest — stop rather than wipe
      // the board; finalCounts already holds this round's tallies.
      for (const id of toEliminate) {
        remaining.add(id)
      }
      recordRound(roundCounts, [])
      break
    }

    recordRound(roundCounts, toEliminate)
  }

  return {
    finalCounts: options.map((option) => ({
      optionId: option.id,
      label: option.label,
      count: finalCounts.get(option.id) ?? 0,
    })),
    rounds,
  }
}
