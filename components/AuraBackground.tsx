const NOISE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

export function AuraBackground({ variant = 'default' }: { variant?: 'default' | 'ff' } = {}) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: variant === 'ff' ? 'var(--aura-gradient-ff)' : 'var(--aura-gradient)' }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_URL}")` }}
      />
    </>
  )
}
