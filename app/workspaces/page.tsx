import Link from 'next/link'
import { listMyWorkspaces } from './_lib/actions'

export default async function WorkspacesPage() {
  const result = await listMyWorkspaces()
  const workspaces = result.success ? (result.workspaces ?? []) : []

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Your workspaces</h1>
          <Link
            href="/workspaces/create"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
          >
            Create Workspace
          </Link>
        </div>

        {!result.success && (
          <p className="mt-6 text-sm text-red-400">{result.error ?? 'Could not load workspaces.'}</p>
        )}

        {result.success && workspaces.length === 0 && (
          <p className="mt-6 text-sm text-neutral-400">
            You&apos;re not in any workspaces yet. Create one to get started.
          </p>
        )}

        {workspaces.length > 0 && (
          <ul className="mt-6 flex flex-col gap-3">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  href={`/workspaces/${workspace.id}`}
                  className="block rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white transition hover:border-neutral-600"
                >
                  {workspace.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
