# Voting App — Project Guidelines

Drop this file at the root of the project repo. Claude Code reads it automatically at the start of every session.

## What this project is
dēmos — a consensus/voting platform. Workspaces (like Slack/Discord) create voting sessions (single/multiple/ranked choice), public or private, with results release and optional post-results comments. Includes a casual "F&F" always-public mode. Full design: see `demos-system-design.md`.

## Stack
Next.js (App Router) frontend + API routes/Server Actions, Supabase for Postgres database, Auth (registered + anonymous sessions), Realtime (live results), and Row Level Security (access control). Hosted on Vercel + Supabase.

## Conventions

**Folder structure — colocated by feature, not by file-type.** Each feature's routes, schema, and server actions ("endpoints") live together in one folder, so a bug in one feature means opening one folder, not hunting across the project. This uses Next.js's built-in colocation support: only `page.tsx`/`layout.tsx`/`route.ts` are treated as routes — anything else in that folder (schema, actions, components) is invisible to the router. Prefix non-route folders with `_` (e.g. `_lib`) to make that explicit.

```
/app
  /(auth)
    /login/page.tsx
    /signup/page.tsx
    _lib/                   — schema.ts, actions.ts (auth-specific)
  /workspaces
    page.tsx                — route: list workspaces
    /[id]
      page.tsx               — route: view one workspace
      _lib/
        schema.ts             — this feature's data shapes/validation
        actions.ts            — this feature's server actions
      _components/            — UI used only in this feature
  /sessions/[id]/...         — same pattern: page + _lib/schema + _lib/actions + _components

/components                 — truly shared UI (buttons, inputs) used across multiple features
/lib
  /supabase                 — client setup (server.ts, client.ts, middleware.ts) — shared plumbing, not feature-owned
  /types                    — DB types generated via `supabase gen types typescript` (don't hand-edit)

/supabase
  /migrations               — SQL files, one per module, numbered prefix + feature name: 002_profiles.sql, 003_workspaces.sql, 005_voting_sessions.sql
    (Supabase CLI requires this exact folder location — the one exception to feature colocation)
CLAUDE.md
demos-system-design.md
```
- Types are generated from the database, not hand-written — run the generator after any schema change instead of manually editing type files.
- One migration file per module, matching the module breakdown in `demos-system-design.md` Section 8. Migrations use a numbered prefix (`00N_feature.sql`), applied in filename order — not bare feature names.
- Auth handled via Supabase (`auth.users` + `public.profiles` split — see design doc Section 8.1). Never write to `auth.users` directly.
- Typography: MuseoModerno (via next/font/google) for headings and large display text only. Everything else stays on the existing sans-serif. Don't re-decide this per page.
- UI varies by `Workspace.type` — identical layout/components for both, varying only visual treatment via a theme. `standard` = restrained dark palette, no avatars, information-dense. `ff` = brighter accents, avatar clusters, image-friendly cards, playful copy. Don't fork into separate component trees.
- Light/dark theme via semantic CSS variable tokens, not hardcoded Tailwind colors. `app/globals.css` defines `--background`, `--surface`, `--surface-hover`, `--foreground`, `--muted`, `--subtle`, `--border`, `--border-strong`, and `--aura-gradient` for both `:root` (light) and `.dark` (dark — the original near-black look, blue gradient at the top; light is white with an orange gradient at the bottom). `tailwind.config.ts` maps them to color utilities (`bg-background`, `text-foreground`, `border-border`, etc.) via `darkMode: 'class'`, so pages use those utility classes instead of `neutral-*`/`white`/`black` and work in both themes automatically — no per-page light variant needed. A `.dark` class on `<html>`, toggled by `components/ThemeToggle.tsx` and persisted to `localStorage('theme')`, controls which set is active; an inline script in `app/layout.tsx` applies it before first paint (reading `localStorage`, falling back to `prefers-color-scheme`) to avoid a flash of the wrong theme. Status/semantic colors (error red, success emerald, warning yellow, the `ff` workspace theme's fuchsia/amber/sky accents) are a separate, intentional concern and stay as literal Tailwind colors, not tokens.

## Rules for AI changes
- Ask before adding new dependencies.
- Do not touch [TODO: e.g. vote-tallying logic, auth] without explicit confirmation — this is the most fragile/important part of the app.
- Keep changes scoped to one feature/file at a time. Don't refactor unrelated code while implementing a feature.
- Prefer small, reviewable diffs over large rewrites.

## Verification checklist (before considering a task done)
- [ ] Code runs locally without errors
- [ ] Manually tested the changed behavior
- [ ] No unrelated files changed
- [ ] Diff reviewed line-by-line before accepting

## Useful context to keep updated here
- Known bugs / gotchas: [TODO]
- Things tried that didn't work: [TODO]
- Links to design docs / mockups: [TODO]

---
*Fill in the TODOs as the project takes shape — this file should grow with the project, not stay static.*
