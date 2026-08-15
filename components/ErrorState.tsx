import Link from 'next/link'

// Full-page failure state for a server component that couldn't load its
// real data — replaces what used to be a silent fallback to fabricated
// placeholder content. Deliberately minimal (no AuraBackground/chrome):
// callers reach for this specifically when they have nothing real to show
// alongside it.
export function ErrorState({
  message,
  backHref,
  backLabel,
}: {
  message: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-sm text-muted">{message}</p>
        {backHref && (
          <Link href={backHref} className="mt-3 inline-block text-sm text-accent underline">
            {backLabel ?? '← Back'}
          </Link>
        )}
      </div>
    </main>
  )
}
