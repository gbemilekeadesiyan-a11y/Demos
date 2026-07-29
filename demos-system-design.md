# dēmos — System Design Reference

*Living document. Update as decisions are made or revised. Last updated: 2026-07-26.*

## 1. Overview

dēmos is a consensus/voting platform. Groups ("workspaces") create voting sessions on topics that matter to them — from company decisions to casual friend-group polls. Two workspace flavors: standard workspaces (admin-controlled, public or private sessions) and DEMOS F&F (always-public, casual, no private mode, built for keeping a running record of group votes).

Full original product doc: [Voting App — dēmos](https://docs.google.com/document/d/1mw_sYo_oF51lYbpkeV1DBZ5OTpCbgqrUL9iSnqPnaKc/edit)

## 2. Locked Product Decisions

| Decision | Choice | Notes |
|---|---|---|
| Voting formats (MVP) | Single choice, multiple choice, ranked choice | Weighted voting planned for later — schema designed so adding it is a column addition, not a redesign |
| Guest voting | Allowed on public sessions | Anonymous voters get a signed token (not a full account) to enforce one-vote-per-session |
| Workspace membership | Many-to-many (one user, many workspaces) | Same model as Slack/Discord |
| MVP scope | Core workspaces + sessions + basic voting + results, AND DEMOS F&F casual mode | Comments, custom result themes = later |
| Departments/sub-groups | Confirmed needed, deferred to phase 2 | Will add a `WorkspaceGroup` entity + membership table, same pattern as `WorkspaceMembership`, once flat member-list access control is working |

## 3. Data Model

| Entity | Key fields | Purpose |
|---|---|---|
| **User** | id, username (unique), email, name, password/SSO, email_verified | Registered account |
| **Workspace** | id, name, type (`standard` / `ff`), created_by, settings | Container for members and sessions |
| **WorkspaceMembership** | user_id, workspace_id, role (admin/moderator/member), status | Join table enabling multi-workspace membership |
| **VotingSession** | workspace_id, title, vote_format, visibility (public/private), status (draft→open→closed→results_released), who_can_vote, allow_anonymous_vote, results_visibility (hidden/live) | A single poll/election, own lifecycle |
| **SessionOption** | session_id, label or linked username, description, image | Ballot choice/candidate |
| **Vote** | session_id, user_id, created_at | "Envelope" proving one vote cast; unique per (session, user_id). `user_id` always points at `auth.users` — registered or anonymous (see Auth module below) |
| **VoteSelection** | vote_id, option_id, rank (nullable) | The actual choice(s); rank populated only for ranked-choice |
| **Comment** | session_id, user_id, body | Post-results discussion (admin-toggled, off by default) |
| **Invite** | workspace_id or session_id, code, expires_at, requires_verification | Join link/QR code |
| **SessionAccessGrant** | session_id, user_id (department support later) | Grants a specific user access to a session when `who_can_vote = invited_list` — separate from general workspace membership |
| **Notification** | user_id, type, payload, read | Email + in-app events |
| **WorkspaceGroup** *(phase 2)* | workspace_id, name | Department/team sub-groups for targeted session access |

**Design notes:**
- `Vote` and `VoteSelection` are split so the same two tables handle single, multiple, and (later) weighted voting without a schema change — only `VoteSelection.rank` (and later `weight`) varies.
- Guest voting no longer needs a custom `anon_token` field. Supabase's anonymous sign-in gives an anonymous voter a real (nameless) row in `auth.users` and a real session, same mechanism as a registered user. `Vote.user_id` can point at that row directly. This is what blocks repeat votes in the same browser — not bulletproof against someone clearing cookies or using another browser, but the standard tradeoff every public poll tool makes. (CAPTCHA/Turnstile would close that gap further — intentionally deferred, see Section 7.)

## 4. Tech Stack

**Chosen: Next.js + Supabase**

| Layer | Choice | Why |
|---|---|---|
| Frontend + lightweight backend | Next.js (App Router) | One JS/TS codebase for UI and API routes/Server Actions — no separate backend service to host |
| Database | Postgres (via Supabase) | Matches our relational data model (memberships, vote selections, rankings) far better than a document DB |
| Auth | Supabase Auth | Handles registered users (email/password, verification) and anonymous sessions (guest voting) in one system |
| Realtime | Supabase Realtime (Postgres Changes) | Live-updating results without hand-building websockets |
| Access control | Postgres Row Level Security (RLS) | Workspace membership / session visibility rules enforced at the database layer, not just in app code |
| Hosting | Vercel (app) + Supabase (data/auth/realtime) | Both have free tiers generous enough for a demo and small-team use |

**Rejected alternatives:** MERN (Node/Express/MongoDB, matching a reference tutorial found during research) — more manual plumbing (hand-rolled JWT auth, Socket.io for realtime) and an awkward fit for our relational data. Plain React + Supabase with no framework — fewest moving parts, but less clear separation of logic as the app grows, still needs serverless functions for tallying/notifications anyway.

## 5. Documentation & References

Compiled for use as AI-prompting context (per the "give the AI relevant docs" practice in our team playbook) and general team reference.

**Next.js**
- [Next.js Docs — App Router](https://nextjs.org/docs/app)
- [Next.js Docs (full)](https://nextjs.org/docs)

**Supabase — core**
- [Supabase Docs (full)](https://supabase.com/docs)
- [Use Supabase Auth with Next.js (quickstart)](https://supabase.com/docs/guides/auth/quickstarts/nextjs)
- [Build a User Management App with Next.js](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)

**Supabase — Auth**
- [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) — for guest voting
- [Security of Anonymous Sign-ins](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL) — abuse prevention (CAPTCHA/Turnstile recommended)

**Supabase — Realtime**
- [Realtime overview](https://supabase.com/docs/guides/realtime)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — for live-updating results
- [Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

**Supabase — Security**
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — for workspace/session access control
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)

**Reference project (comparison only — much simpler scope than dēmos, no workspaces/roles/anonymous voting/ranked choice)**
- [Full Stack MERN Voting App playlist (Kelvin Mai / freeCodeCamp)](https://www.youtube.com/playlist?list=PLBeQxJQNprbgrNfcntLO8N2Y-dzlMZXZe)
- [kelvin-mai/mern-vote repo](https://github.com/kelvin-mai/mern-vote)

## 6. Visual / UX References (for frontend)

Real, shipped-product examples to feed Claude Code alongside instructions ("build this screen to look/behave like X"), rather than describing UI in words alone. Owner: Samuel (frontend).

| Reference | URL | What to borrow from it |
|---|---|---|
| Slido | [slido.com](https://www.slido.com/) | Live poll creation flow, presenter vs. participant view, results display styles (bar chart, word cloud, ranking) |
| Poll Everywhere | [polleverywhere.com](https://www.polleverywhere.com/) | Multiple question-type UI (single/multiple/ranked), simple audience-facing voting screen |
| Discord | discord.com | Workspace/server switcher sidebar, invite-link/code flow, role-based permission settings UI |
| Slack | slack.com | Workspace switcher, member invite flow, admin settings panel layout |

Practice: screenshot the specific screen/flow you're referencing (not just the homepage) and drop it directly into the Claude Code chat with the instruction.

**Frontend workflow (Samuel):** Figma for prototyping, Mobbin for real-app reference screenshots, Claude for design generation/critique in the loop between the two.

## 7. Deferred / Known Gaps

| Item | Why deferred | Revisit when |
|---|---|---|
| CAPTCHA / Turnstile on anonymous sign-in | Not needed for a demo; adds setup complexity for a problem (bot abuse) we don't have yet | Before any real/public deployment beyond demo use |

## 8. Module Designs

### 8.1 Auth & Identity — *designed*

**Two-table split:** Supabase manages `auth.users` (email, password hash, email verification status) — we never write to it directly. Our app-specific fields (username, first/last name) live in a separate `public.profiles` table, one row per user, linked by matching id.

**Sign-up flow:** User submits email + name + username + password → Supabase `signUp()` creates the `auth.users` row and sends the verification email → a Postgres trigger (`on_auth_user_created` → `handle_new_user()`) automatically creates the matching `profiles` row → user clicks the email link to verify. Trigger pattern is Supabase's documented standard (not custom), see [Managing user data](https://supabase.com/docs/guides/auth/managing-user-data) / [troubleshooting guide](https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A) — chosen over app-code-side profile creation because it fires regardless of sign-up method (password now, SSO later) so a user can never end up without a profile row.

**Login flow:** Supabase `signInWithPassword()` → session stored in a cookie via `@supabase/ssr`, readable by both Next.js server components and client components.

**Anonymous voting:** Supabase `signInAnonymously()` creates an `auth.users` row with `is_anonymous = true`, no email, no `profiles` row needed. `Vote.user_id` references this row directly — see Section 3 data model note.

**Upgrade path (anon → full account):** Supabase's identity-linking function attaches an email/password to the *existing* anonymous session (same user id, not a new one) → a `profiles` row is created at that point. Any votes cast while anonymous stay attached, since the id never changes.

**API contract — user references:** anywhere a server action's return type references a user (session/workspace creators, workspace members), it carries a `UserSummary` (`id`, `username`, `firstName`, `lastName` — joined from `profiles`) instead of a bare `auth.users` id, so the frontend never needs a second round-trip just to show a name. Joined via one batched `profiles` lookup per call (not a lookup per row). Anonymous users have no `profiles` row, so they resolve to `null` rather than failing the query — callers render a placeholder ("Guest", "Anonymous") for that case.

### 8.2 Workspace, Membership & Invite — *designed*

**Creating a workspace:** the creator automatically gets a `WorkspaceMembership` row with `role = admin`. No separate step — founding is becoming admin.

**Roles:** `admin` (full control), optional `moderator` (secondary tier), `member` (default). Lives on `WorkspaceMembership.role` — one user can hold different roles across different workspaces since membership is per-workspace, not global.

**Invites:** admin generates an `Invite` (unique code, optionally QR-wrapped). If `requires_admin_verification = false`, using the code creates an active `WorkspaceMembership` immediately. If `true`, it creates a `status = pending` membership and the admin approves/rejects it from a request queue.

**Joining a session by code:** `joinSessionByCode(code: string): Promise<{ success: boolean; error?: string; sessionId?: string }>` — looks up the `Invite` row by code and checks `expires_at`. On a valid, unexpired code it grants access (`SessionAccessGrant` for a session-scoped invite, `WorkspaceMembership` for a workspace-scoped one) and returns `{ success: true, sessionId }` so the caller can redirect straight into the session. On an unknown or expired code it returns `{ success: false, error: "Invalid or expired code" }` — no separate distinction between "wrong code" and "expired code" is surfaced to the user.

**Access enforcement:** every workspace-scoped table gets a Postgres Row Level Security policy checking for an active `WorkspaceMembership` linking `auth.uid()` to that workspace — enforced at the database layer, not hand-written in app code. F&F workspaces skip the private-visibility check entirely (no private mode by design).

**Membership rows carry a profile:** `getWorkspaceDetails`'s `members` and `pendingRequests` each carry `user: UserSummary | null` per the user-reference contract in § 8.1, not a bare `user_id` — `user_id` is still present for FK-level comparisons (e.g. "is this row the current user"), the profile is additive. A member can legitimately be anonymous (an anonymous session can still redeem a workspace invite code, since `join_workspace_by_code` only requires `auth.uid()` to be non-null), so `user` is `null` for those rows.

**Flagged for the Voting Session module:** the original doc calls for admins granting session access to specific users/departments, not just "all workspace members." This needs its own table (`SessionAccessGrant`: session_id + user or, later, department) — finalized when the Voting Session module is designed next, since that's where it's consumed.

### 8.3 Voting Session lifecycle & vote casting/tallying — *designed*

**Lifecycle:** `VotingSession.status` = draft → open → closed → results_released. RLS refuses any `Vote` insert unless status = `open`.

**Session-level access (`SessionAccessGrant`, finalized):** used when `who_can_vote = invited_list` — a specific user is granted access to one session independent of general workspace membership (department support deferred the same way as `WorkspaceGroup`). `all_members` checks `WorkspaceMembership` instead; `public_link` allows anyone (plus anonymous, if `allow_anonymous_vote`).

**Session rows carry a profile:** `listSessions` and `getSessionDetails` return `createdBy: UserSummary | null` per the user-reference contract in § 8.1, joined via one batched `profiles` lookup for the whole result set rather than per row. In practice a session's creator is always a workspace admin (a registered user), so `null` should be rare here — but the same null-safe shape as `WorkspaceMembership.user` is used for consistency rather than assuming that always holds.

**Double-voting prevention:** database-level uniqueness constraint on `Vote(session_id, user_id)` — structurally impossible, not just an app-level check.

**Tallying:** single/multiple choice = `COUNT(VoteSelection) GROUP BY option_id`. Ranked choice = Instant Runoff Voting — tally first-choice votes, eliminate the lowest, redistribute those ballots to next-ranked remaining option, repeat until majority. Computed fresh on read rather than kept as a running counter (simple-and-correct over fast-but-could-drift, appropriate for a demo).

**Results visibility:** same RLS-enforcement pattern as workspace access — if `results_visibility = hidden_until_close`, RLS blocks non-admins from reading `Vote`/`VoteSelection` until `status = results_released`, not just hidden in the UI. If `live`, Supabase Realtime streams count changes straight to the frontend.

### 8.4 Results, Realtime & Notifications — *designed*

**Results presentation:** `VotingSession.results_style` = bar chart / pie chart / leaderboard (custom styles = later stretch goal). Frontend renders whatever the tallying logic returns using Recharts (standard React/Next.js charting library).

**Realtime wiring:** single/multiple choice — subscribe to `Vote`/`VoteSelection` changes filtered by session_id, update counts live. Ranked choice — **recommend disabling live leaderboard view** even though the setting allows it: IRV results can flip entirely as more ballots arrive and eliminations happen, so a live view can mislead voters mid-poll about who's winning. Show live vote count only ("X people have voted"), reveal actual IRV results after close. Overridable default, not a hard rule.

**Notifications:** Supabase's built-in email is capped at 2/hour and scoped to its own auth flows only — not suitable for our own notification emails. Real flow: a database event (session closed, invite created, comment posted) triggers a Supabase Edge Function, which inserts the in-app `Notification` row and calls a transactional email provider — [Resend](https://resend.com/supabase) (generous free tier, documented Supabase integration).

## 9. All Core Modules Designed

Data model, stack, and all four modules (Auth & Identity, Workspace/Membership/Invite, Voting Session lifecycle/tallying, Results/Realtime/Notifications) are now documented above. Next phase: implementation, module by module, in the same order.

---
*Companion file: `CLAUDE.md` (project conventions for Claude Code) and `team-ai-demo-playbook.md` (general AI-assisted coding practices).*
