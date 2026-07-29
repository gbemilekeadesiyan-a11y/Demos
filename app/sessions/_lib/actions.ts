'use server'

import type { SessionOption, VotingSession } from './schema'

export async function createVotingSession(
  workspaceId: string,
  formData: {
    title: string
    description?: string
    voteFormat: 'single' | 'multiple' | 'ranked'
    visibility: 'public' | 'private'
    whoCanVote: 'all_members' | 'invited_list' | 'public_link'
    allowAnonymousVote: boolean
    resultsVisibility: 'hidden_until_close' | 'live' | 'after_you_vote'
    startTime?: string
    endTime?: string
  }
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  throw new Error('not implemented')
}

export async function addSessionOption(
  sessionId: string,
  formData: { label: string; description?: string; imageUrl?: string }
): Promise<{ success: boolean; error?: string; optionId?: string }> {
  throw new Error('not implemented')
}

export async function grantSessionAccess(
  sessionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export async function openSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export async function closeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export async function releaseResults(sessionId: string): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export async function castVote(
  sessionId: string,
  selections: { optionId: string; rank?: number }[]
): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export async function getSessionDetails(sessionId: string): Promise<{
  success: boolean
  error?: string
  session?: VotingSession
  options?: SessionOption[]
  hasVoted?: boolean
}> {
  throw new Error('not implemented')
}

export async function getSessionResults(sessionId: string): Promise<{
  success: boolean
  error?: string
  results?: { optionId: string; label: string; count: number }[]
  totalVotes?: number
  resultsLocked?: boolean
}> {
  throw new Error('not implemented')
}
