'use client'

import { useState } from 'react'
import { AuraBackground } from '@/components/AuraBackground'
import { approveMembership, generateInvite, rejectMembership, updateMemberRole } from '../../_lib/actions'
import type { Workspace, WorkspaceMembership } from '../../_lib/schema'

function displayName(member: WorkspaceMembership) {
  if (!member.user) {
    // Anonymous member — no profiles row to draw a name from.
    return `Guest ${member.user_id.slice(0, 8)}`
  }
  const fullName = `${member.user.firstName} ${member.user.lastName}`.trim()
  return fullName || member.user.username
}

export function WorkspaceDetailClient({
  workspaceId,
  workspace,
  initialMembers,
  initialPendingRequests,
  isAdmin,
  usingFakeData,
}: {
  workspaceId: string
  workspace: Workspace
  initialMembers: WorkspaceMembership[]
  initialPendingRequests: WorkspaceMembership[]
  isAdmin: boolean
  usingFakeData: boolean
}) {
  const [members, setMembers] = useState(initialMembers)
  const [pendingRequests, setPendingRequests] = useState(initialPendingRequests)
  const [error, setError] = useState<string | null>(null)

  const [requiresVerification, setRequiresVerification] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  async function handleRoleChange(membershipId: string, role: 'admin' | 'moderator' | 'member') {
    setError(null)
    const previous = members
    setMembers((current) => current.map((member) => (member.id === membershipId ? { ...member, role } : member)))

    const result = await updateMemberRole(membershipId, role)
    if (!result.success) {
      setMembers(previous)
      setError(result.error ?? 'Could not update role')
    }
  }

  async function handleApprove(membershipId: string) {
    setError(null)
    const result = await approveMembership(membershipId)
    if (!result.success) {
      setError(result.error ?? 'Could not approve request')
      return
    }
    const approved = pendingRequests.find((request) => request.id === membershipId)
    setPendingRequests((current) => current.filter((request) => request.id !== membershipId))
    if (approved) {
      setMembers((current) => [...current, { ...approved, status: 'active' }])
    }
  }

  async function handleReject(membershipId: string) {
    setError(null)
    const result = await rejectMembership(membershipId)
    if (!result.success) {
      setError(result.error ?? 'Could not reject request')
      return
    }
    setPendingRequests((current) => current.filter((request) => request.id !== membershipId))
  }

  async function handleGenerateInvite() {
    setError(null)
    setInviteLoading(true)
    const result = await generateInvite(workspaceId, { requiresVerification })
    setInviteLoading(false)

    if (!result.success || !result.inviteCode) {
      setError(result.error ?? 'Could not generate invite')
      return
    }
    setInviteCode(result.inviteCode)
  }

  const inviteLink =
    inviteCode && typeof window !== 'undefined' ? `${window.location.origin}/join?code=${inviteCode}` : null

  const qrSrc = inviteLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteLink)}`
    : null

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 px-4 py-12">
      <AuraBackground />

      <div className="relative mx-auto max-w-2xl">
        {usingFakeData && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/50 px-4 py-2 text-xs text-yellow-400">
            Showing placeholder data — getWorkspaceDetails isn&apos;t implemented yet.
          </p>
        )}

        <h1 className="font-heading text-3xl text-white">{workspace.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {workspace.type === 'ff' ? 'F&F workspace' : 'Standard workspace'}
        </p>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <section className="mt-8">
          <h2 className="text-sm font-medium text-neutral-300">Members</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-neutral-700" />
                  <span className="text-sm text-neutral-300">{displayName(member)}</span>
                </div>

                {isAdmin ? (
                  <select
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(member.id, e.target.value as 'admin' | 'moderator' | 'member')
                    }
                    className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white outline-none focus:border-neutral-600"
                  >
                    <option value="admin">admin</option>
                    <option value="moderator">moderator</option>
                    <option value="member">member</option>
                  </select>
                ) : (
                  <span className="text-xs text-neutral-400">{member.role}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-neutral-300">Pending requests</h2>
            {pendingRequests.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">No pending requests.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {pendingRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3"
                  >
                    <span className="text-sm text-neutral-300">{displayName(request)}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        className="rounded-md bg-white px-3 py-1 text-xs font-medium text-neutral-950 transition hover:bg-neutral-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-500"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isAdmin && (
          <section className="mt-8 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <h2 className="text-sm font-medium text-neutral-300">Share workspace</h2>

            <label className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={requiresVerification}
                onChange={(e) => setRequiresVerification(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-700 bg-neutral-900"
              />
              Require admin verification to join
            </label>

            <button
              onClick={handleGenerateInvite}
              disabled={inviteLoading}
              className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {inviteLoading ? 'Generating…' : 'Generate Invite Link'}
            </button>

            {inviteLink && (
              <div className="mt-4 flex flex-col items-start gap-3">
                <input
                  readOnly
                  value={inviteLink}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qrSrc && (
                  <img src={qrSrc} alt="Invite QR code" className="h-32 w-32 rounded-lg border border-neutral-800" />
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
