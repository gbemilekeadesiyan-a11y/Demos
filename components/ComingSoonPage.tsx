import Link from 'next/link'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center">
      <AuraBackground />
      <div className="relative">
        <Link href="/" className="mb-6 inline-block">
          <Logo className="h-8 w-auto text-foreground" />
        </Link>
        <h1 className="font-heading text-4xl text-foreground sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Coming soon.</p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm text-muted underline transition hover:text-foreground"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  )
}
