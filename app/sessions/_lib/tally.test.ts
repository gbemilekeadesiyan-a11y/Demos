import { describe, expect, it } from 'vitest'
import { tallyRankedChoice, tallySimpleChoice } from './tally'

const options = [
  { id: 'a', label: 'Messi' },
  { id: 'b', label: 'Ronaldo' },
  { id: 'c', label: 'Neymar' },
]

function selection(voteId: string, optionId: string, rank: number | null) {
  return { vote_id: voteId, option_id: optionId, rank }
}

describe('tallySimpleChoice', () => {
  it('counts one vote per selection row', () => {
    const results = tallySimpleChoice(options, [
      { option_id: 'a' },
      { option_id: 'a' },
      { option_id: 'b' },
    ])

    expect(results).toEqual([
      { optionId: 'a', label: 'Messi', count: 2 },
      { optionId: 'b', label: 'Ronaldo', count: 1 },
      { optionId: 'c', label: 'Neymar', count: 0 },
    ])
  })

  it('returns every option at zero when there are no selections', () => {
    const results = tallySimpleChoice(options, [])
    expect(results.map((r) => r.count)).toEqual([0, 0, 0])
  })
})

describe('tallyRankedChoice', () => {
  it('resolves on a first-round majority without eliminating anyone', () => {
    const selections = [
      selection('v1', 'a', 1),
      selection('v2', 'a', 1),
      selection('v3', 'a', 1),
      selection('v4', 'b', 1),
    ]

    const { finalCounts, rounds } = tallyRankedChoice(options, selections)

    expect(finalCounts).toEqual([
      { optionId: 'a', label: 'Messi', count: 3 },
      { optionId: 'b', label: 'Ronaldo', count: 1 },
      { optionId: 'c', label: 'Neymar', count: 0 },
    ])
    expect(rounds).toHaveLength(1)
    expect(rounds[0].eliminated).toEqual([])
  })

  it('eliminates the lowest option and redistributes to the next ranked choice', () => {
    // Round 1: a=2, b=2, c=1 — c is uniquely lowest and is eliminated. Its
    // one ballot's second choice (b) is added to b's round-2 count, giving
    // b a majority (3 of 5 counted ballots).
    const selections = [
      selection('v1', 'a', 1),
      selection('v5', 'a', 1),
      selection('v2', 'b', 1),
      selection('v3', 'b', 1),
      selection('v4', 'c', 1),
      selection('v4', 'b', 2),
    ]

    const { finalCounts, rounds } = tallyRankedChoice(options, selections)

    expect(rounds).toHaveLength(2)
    expect(rounds[0].eliminated).toEqual(['c'])
    expect(finalCounts.find((r) => r.optionId === 'a')?.count).toBe(2)
    expect(finalCounts.find((r) => r.optionId === 'b')?.count).toBe(3)
    // c is untouched after elimination, so its finalCounts entry keeps its
    // round-1 tally rather than resetting to 0 — that's the last round it
    // was actually still standing.
    expect(finalCounts.find((r) => r.optionId === 'c')?.count).toBe(1)
  })

  it('drops an exhausted ballot from later rounds instead of counting it for no one', () => {
    // c has one first-choice vote and no second choice ranked at all. Once
    // c is eliminated, that ballot is exhausted — dropped from round 2's
    // count and, crucially, from its majority denominator too.
    const selections = [
      selection('v1', 'a', 1),
      selection('v2', 'a', 1),
      selection('v3', 'a', 1),
      selection('v4', 'b', 1),
      selection('v5', 'b', 1),
      selection('v6', 'c', 1),
    ]

    const { finalCounts, rounds } = tallyRankedChoice(options, selections)

    expect(rounds).toHaveLength(2)
    expect(rounds[0].eliminated).toEqual(['c'])

    // Round 2 only counts 5 of the 6 ballots (a=3, b=2) — c's exhausted
    // ballot is excluded rather than counted for no one. If it weren't
    // dropped from the denominator, 3 of 6 wouldn't clear "more than half".
    const round2 = rounds[1]
    expect(round2.counts.reduce((sum, c) => sum + c.count, 0)).toBe(5)
    expect(finalCounts.find((r) => r.optionId === 'a')?.count).toBe(3)
    expect(finalCounts.find((r) => r.optionId === 'b')?.count).toBe(2)
  })

  it('eliminates every tied-lowest option in the same round', () => {
    // b and c tie for lowest (1 each) and are eliminated together in round 1.
    const selections = [
      selection('v1', 'a', 1),
      selection('v2', 'a', 1),
      selection('v3', 'b', 1),
      selection('v4', 'c', 1),
    ]

    const { rounds } = tallyRankedChoice(options, selections)

    expect(rounds[0].eliminated.sort()).toEqual(['b', 'c'])
  })

  it('stops without a winner when every remaining option ties', () => {
    const selections = [selection('v1', 'a', 1), selection('v2', 'b', 1)]

    const twoOptions = options.slice(0, 2)
    const { finalCounts, rounds } = tallyRankedChoice(twoOptions, selections)

    expect(rounds).toHaveLength(1)
    expect(rounds[0].eliminated).toEqual([])
    expect(finalCounts).toEqual([
      { optionId: 'a', label: 'Messi', count: 1 },
      { optionId: 'b', label: 'Ronaldo', count: 1 },
    ])
  })

  it('returns every option at zero when there are no ranked selections', () => {
    const { finalCounts, rounds } = tallyRankedChoice(options, [])
    expect(finalCounts.every((r) => r.count === 0)).toBe(true)
    expect(rounds).toHaveLength(1)
  })

  it('ignores selections with a null rank', () => {
    const selections = [selection('v1', 'a', null), selection('v2', 'b', 1)]

    const { finalCounts } = tallyRankedChoice(options, selections)

    expect(finalCounts.find((r) => r.optionId === 'a')?.count).toBe(0)
    expect(finalCounts.find((r) => r.optionId === 'b')?.count).toBe(1)
  })
})
