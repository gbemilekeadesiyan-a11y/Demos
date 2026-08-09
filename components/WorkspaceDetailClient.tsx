'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AuraBackground } from '@/components/AuraBackground'
import {
  addMemberToDepartment,
  approveMembership,
  createDepartment,
  deleteDepartment,
  generateInvite,
  inviteByIdentifier,
  listDepartments,
  rejectMembership,
  removeMemberFromDepartment,
  renameDepartment,
  updateMemberRole,
} from '@/app/workspaces/_lib/actions'
import type { DepartmentWithMembers, Workspace, WorkspaceMembership } from '@/app/workspaces/_lib/schema'

type RoleOption = 'admin' | 'moderator' | 'member'

// Visual/copy treatment per workspace.type — same "identical
// layout/components, only visual treatment differs" rule as
// WorkspaceDashboardClient's THEME. overviewBase picks the route prefix
// (/workspaces or /family) the "View Overview" link resolves under, since
// each surface's overview page lives at its own top-level route.
// showDepartments is the one structural (not just visual) difference:
// departments are Workspaces-only, enforced at the database layer
// (018_departments.sql) as well as by this flag never offering the UI for ff.
const DETAIL_THEME: Record<
  'standard' | 'ff',
  {
    subtitle: string
    avatarClass: string
    primaryBtnClass: string
    inviteSectionClass: string
    inviteSectionTitle: string
    overviewBase: string
    showDepartments: boolean
  }
> = {
  standard: {
    subtitle: 'Standard workspace',
    avatarClass: 'bg-border-strong',
    primaryBtnClass: 'bg-accent text-accent-foreground',
    inviteSectionClass: 'border-border bg-surface/60',
    inviteSectionTitle: 'Share workspace',
    overviewBase: '/workspaces',
    showDepartments: true,
  },
  ff: {
    subtitle: 'Friends & Family group',
    avatarClass: 'bg-gradient-to-br from-fuchsia-500 to-violet-500',
    primaryBtnClass: 'bg-fuchsia-500 text-white',
    inviteSectionClass: 'border-fuchsia-400/20 bg-fuchsia-500/5',
    inviteSectionTitle: 'Invite to group',
    overviewBase: '/family',
    showDepartments: false,
  },
}

function displayName(member: WorkspaceMembership) {
  if (!member.user) {
    // Anonymous member — no profiles row to draw a name from.
    return `Guest ${member.user_id.slice(0, 8)}`
  }
  const fullName = `${member.user.firstName} ${member.user.lastName}`.trim()
  return fullName || member.user.username
}

function roleLabel(member: WorkspaceMembership, ownerId: string | undefined) {
  if (ownerId && member.user_id === ownerId) return 'Owner'
  if (member.role === 'admin') return 'Admin'
  if (member.role === 'moderator') return 'Moderator'
  return 'Member'
}

function roleBadgeClass(label: string) {
  switch (label) {
    case 'Owner':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
    case 'Admin':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-400'
    case 'Moderator':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-400'
    default:
      return 'border-border-strong bg-foreground/5 text-muted'
  }
}

// Owner touches the admin tier (promotes into it, demotes out of it);
// a plain admin only shuffles moderator/member and never edits another
// admin's row or grants admin themselves. The owner's own row is never
// editable by anyone, including themselves — ownership only moves via
// transferOwnership (see 017_workspace_ownership_and_invites.sql, which
// blocks a direct role/created_by write on that row regardless of who's
// asking).
function editableRoleOptions(
  member: WorkspaceMembership,
  ownerId: string | undefined,
  viewerIsOwner: boolean,
  viewerIsAdmin: boolean
): RoleOption[] | null {
  if (ownerId && member.user_id === ownerId) return null
  if (viewerIsOwner) return ['admin', 'moderator', 'member']
  if (viewerIsAdmin && member.role !== 'admin') return ['moderator', 'member']
  return null
}

function AddPeopleSection({ workspaceId, canInviteAdmin }: { workspaceId: string; canInviteAdmin: boolean }) {
  const [identifier, setIdentifier] = useState('')
  const [role, setRole] = useState<RoleOption>('member')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const result = await inviteByIdentifier(workspaceId, identifier.trim(), role)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Could not send invite')
      return
    }

    setIdentifier('')
    setSuccess(true)
  }

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Username or email"
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value)
            setError(null)
            setSuccess(false)
          }}
          required
          className="min-w-[10rem] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleOption)}
          className="rounded-lg border border-border bg-surface px-2 py-2 text-xs text-foreground outline-none focus:border-border-strong"
        >
          {canInviteAdmin && <option value="admin">admin</option>}
          <option value="moderator">moderator</option>
          <option value="member">member</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Add'}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-400">Invite sent.</p>}
    </div>
  )
}

function DepartmentsSection({ workspaceId, members }: { workspaceId: string; members: WorkspaceMembership[] }) {
  const [departments, setDepartments] = useState<DepartmentWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const result = await listDepartments(workspaceId)
      if (!cancelled) {
        if (result.success) {
          setDepartments(result.departments ?? [])
        } else {
          setError(result.error ?? 'Could not load departments')
        }
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [workspaceId])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newName.trim()) return

    setCreating(true)
    setError(null)
    const result = await createDepartment(workspaceId, newName.trim())
    setCreating(false)

    if (!result.success || !result.groupId) {
      setError(result.error ?? 'Could not create department')
      return
    }

    setDepartments((current) => [
      ...current,
      { id: result.groupId!, workspace_id: workspaceId, name: newName.trim(), created_at: new Date().toISOString(), memberIds: [] },
    ])
    setNewName('')
  }

  async function handleRename(groupId: string) {
    if (!renameValue.trim()) return
    const previous = departments
    setDepartments((current) =>
      current.map((dept) => (dept.id === groupId ? { ...dept, name: renameValue.trim() } : dept))
    )
    setRenamingId(null)

    const result = await renameDepartment(groupId, renameValue.trim())
    if (!result.success) {
      setDepartments(previous)
      setError(result.error ?? 'Could not rename department')
    }
  }

  async function handleDelete(groupId: string) {
    const previous = departments
    setDepartments((current) => current.filter((dept) => dept.id !== groupId))

    const result = await deleteDepartment(groupId)
    if (!result.success) {
      setDepartments(previous)
      setError(result.error ?? 'Could not delete department')
    }
  }

  async function toggleMember(groupId: string, membershipId: string, assigned: boolean) {
    const previous = departments
    setDepartments((current) =>
      current.map((dept) =>
        dept.id === groupId
          ? {
              ...dept,
              memberIds: assigned
                ? dept.memberIds.filter((id) => id !== membershipId)
                : [...dept.memberIds, membershipId],
            }
          : dept
      )
    )

    const result = assigned
      ? await removeMemberFromDepartment(groupId, membershipId)
      : await addMemberToDepartment(groupId, membershipId)

    if (!result.success) {
      setDepartments(previous)
      setError(result.error ?? 'Could not update department members')
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-muted">Departments</h2>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : departments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No departments yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {departments.map((dept) => (
            <li key={dept.id} className="rounded-lg border border-border bg-surface/80 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                {renamingId === dept.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(dept.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(dept.id)}
                    autoFocus
                    className="flex-1 rounded-md border border-border-strong bg-surface px-2 py-1 text-sm text-foreground outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => (current === dept.id ? null : dept.id))}
                    className="text-left text-sm text-foreground transition hover:underline"
                  >
                    {dept.name}{' '}
                    <span className="text-xs text-subtle">
                      ({dept.memberIds.length} member{dept.memberIds.length === 1 ? '' : 's'})
                    </span>
                  </button>
                )}

                <div className="flex shrink-0 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(dept.id)
                      setRenameValue(dept.name)
                    }}
                    className="text-muted transition hover:text-foreground"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(dept.id)}
                    className="text-muted transition hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === dept.id && (
                <ul className="mt-3 flex flex-col gap-1 border-t border-divider pt-3">
                  {members.map((member) => {
                    const assigned = dept.memberIds.includes(member.id)
                    return (
                      <li key={member.id}>
                        <label className="flex items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={assigned}
                            onChange={() => toggleMember(dept.id, member.id, assigned)}
                            className="h-3.5 w-3.5 rounded border-border-strong bg-surface"
                          />
                          {displayName(member)}
                        </label>
                      </li>
                    )
                  })}
                  {members.length === 0 && <li className="text-xs text-subtle">No members to assign yet.</li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-3 flex gap-2">
        <input
          type="text"
          placeholder="New department name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating…' : '+ Add'}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  )
}

export function WorkspaceDetailClient({
  workspaceId,
  workspace,
  currentUserId,
  initialMembers,
  initialPendingRequests,
  isAdmin,
  usingFakeData,
}: {
  workspaceId: string
  workspace: Workspace
  currentUserId: string | null
  initialMembers: WorkspaceMembership[]
  initialPendingRequests: WorkspaceMembership[]
  isAdmin: boolean
  usingFakeData: boolean
}) {
  const theme = DETAIL_THEME[workspace.type === 'ff' ? 'ff' : 'standard']
  const ownerId = workspace.createdBy?.id
  const isOwner = Boolean(currentUserId && ownerId === currentUserId)

  const [members, setMembers] = useState(initialMembers)
  const [pendingRequests, setPendingRequests] = useState(initialPendingRequests)
  const [error, setError] = useState<string | null>(null)

  const [requiresVerification, setRequiresVerification] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  async function handleRoleChange(membershipId: string, role: RoleOption) {
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
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-12">
      <AuraBackground />

      <div className="relative mx-auto max-w-2xl">
        {usingFakeData && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/50 px-4 py-2 text-xs text-yellow-400">
            Showing placeholder data — getWorkspaceDetails isn&apos;t implemented yet.
          </p>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl text-foreground">{workspace.name}</h1>
            <p className="mt-1 text-sm text-muted">{theme.subtitle}</p>
          </div>

          {isAdmin && (
            <Link
              href={`${theme.overviewBase}/${workspaceId}/overview`}
              className="rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:border-border-strong hover:text-foreground"
            >
              View Overview
            </Link>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted">Members</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {members.map((member) => {
              const label = roleLabel(member, ownerId)
              const options = editableRoleOptions(member, ownerId, isOwner, isAdmin)

              return (
                <li
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface/80 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full ${theme.avatarClass}`} />
                    <span className="text-sm text-muted">{displayName(member)}</span>
                  </div>

                  {options ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as RoleOption)}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground outline-none focus:border-border-strong"
                    >
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${roleBadgeClass(label)}`}
                    >
                      {label}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          {isAdmin && <AddPeopleSection workspaceId={workspaceId} canInviteAdmin={isOwner} />}
        </section>

        {isAdmin && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-muted">Pending requests</h2>
            {pendingRequests.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No pending requests.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {pendingRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface/80 px-4 py-3"
                  >
                    <span className="text-sm text-muted">{displayName(request)}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition hover:opacity-90 ${theme.primaryBtnClass}`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="rounded-md border border-border-strong px-3 py-1 text-xs text-muted transition hover:border-foreground/40"
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

        {isAdmin && theme.showDepartments && <DepartmentsSection workspaceId={workspaceId} members={members} />}

        {isAdmin && (
          <section className={`mt-8 rounded-lg border p-4 ${theme.inviteSectionClass}`}>
            <h2 className="text-sm font-medium text-muted">{theme.inviteSectionTitle}</h2>

            <label className="mt-3 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={requiresVerification}
                onChange={(e) => setRequiresVerification(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-strong bg-surface"
              />
              Require admin verification to join
            </label>

            <button
              onClick={handleGenerateInvite}
              disabled={inviteLoading}
              className={`mt-3 rounded-full px-4 py-2 text-xs font-medium transition hover:opacity-90 disabled:opacity-50 ${theme.primaryBtnClass}`}
            >
              {inviteLoading ? 'Generating…' : 'Generate Invite Link'}
            </button>

            {inviteLink && (
              <div className="mt-4 flex flex-col items-start gap-3">
                <input
                  readOnly
                  value={inviteLink}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qrSrc && (
                  <img src={qrSrc} alt="Invite QR code" className="h-32 w-32 rounded-lg border border-border" />
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
