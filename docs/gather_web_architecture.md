# Gather Web — Architecture & Migration Plan

_Started 2026-09-12. Replaces the Salesforce-era `gather_apex_architecture.md`/`gather_frontend_architecture.md` as the going-forward reference for this project. The Salesforce SFDX project (`eventio` repo) remains untouched as the design spec this build was ported from — see its `project/` docs for the original ERD, business rules, and LWC screen inventory this plan translates._

## Context

Gather's backend was fully built on Salesforce (158 Apex classes, 253 passing tests, a working ERD) and the LWC frontend was partially planned/built on top of it. Investigating a licensing question (self-registering vendors need Account-create permission, which requires a Customer Community **Plus** license) surfaced a deeper structural problem: Salesforce Experience Cloud licenses are priced per external login/member — every additional free signup is a recurring cost that scales with the project's best-case outcome (growth). That's the wrong cost shape for a project explicitly optimizing for free signups and viral growth.

Decision made with the project owner: **fully migrate off Salesforce** to a modern, usage-priced web stack. The existing Salesforce data model and business rules (ERD, Apex architecture, the LWC screen/navigation inventory) were treated as a **design spec to port**, not code to reuse — this plan translates that spec into a new system, not a copy of the old one.

---

## Recommended Stack (reasoned out)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router, React)** | Largest ecosystem, easiest to hire for later, first-class support on every host below. Server Components + Server Actions replace a lot of what Apex controllers did. |
| Database | **Postgres via Supabase** | Supabase = hosted Postgres + Auth + Storage + **Row Level Security** in one free-tier product. RLS is a near-exact conceptual replacement for Salesforce's OWD-Private-plus-explicit-sharing model the ERD already relies on — same mental model, different syntax. Not a lock-in: it's plain Postgres, portable to any Postgres host if you ever outgrow Supabase. |
| Auth | **Supabase Auth** | Bundled, free up to a generous MAU threshold, integrates directly with RLS via `auth.uid()`. Handles email/password + social login, replacing `Site.createExternalUser`/`SalesforceSiteRegistrar` entirely — and removes the whole license-tier problem that started this investigation, because there's no per-login fee at all. |
| ORM | **Drizzle** | Thin, SQL-close, fully typed — a good match for a developer used to writing precise Apex/SOQL rather than fighting a heavy abstraction. |
| Background jobs | **Supabase Edge Functions + `pg_cron`**, or **Inngest** if durable retries/step functions are needed | Replaces the hourly reminder Queueable. Inngest's free tier gives Salesforce-Queueable-like per-step retry semantics if the reminder/payment logic gets complex. |
| Payments | **Stripe** | The original ERD already reserved `Payment_Gateway__c`/`Gateway_Transaction_Id__c`/`Gateway_Status__c` fields for this — carries a design decision already made, not a new one. |
| File storage | **Supabase Storage** | Cover images, quote documents — same product as the DB/auth, one less vendor to integrate. |
| Hosting | **Vercel** (app) + **Supabase** (data/auth/storage) | Both have real free tiers today and both bill on usage (bandwidth/compute/rows), not per registered user — the actual property being optimized for. Flag: Vercel bandwidth pricing is the one line item worth watching if traffic gets very large; Supabase/Postgres compute is cheap and predictable by comparison. |

This is "boring technology" on purpose — every piece here is mainstream, well-documented, and replaceable independently, so a big traffic spike is a scaling problem to solve with money, not a rewrite.

---

## Data Model Port (Salesforce ERD → Postgres)

| Salesforce entity | Postgres table | Notes |
|---|---|---|
| Person Account / User | `users` (managed by Supabase Auth) + `profiles` | Profile row keyed to `auth.users.id`. |
| Event__c | `events` | `owner_id`, `status`, `visibility`, `event_type`, `start_at`/`end_at` (real `timestamptz`, no hardcoded timezone), `capacity`, `location`, `description`, `cover_image_url`. |
| Event_Collaborator__c | `event_collaborators` | Join table: `event_id`, `user_id`, `permission_level`, `status`. Drives an RLS policy, see below. |
| Event_Attendee__c | `event_attendees` | `event_id`, nullable `contact_user_id`, fallback `name`/`email`/`phone`, `rsvp_status`, `guest_count`. |
| Event_Task__c | `event_tasks` | `event_id`, `title`, `due_date`, `completed`, `priority`, `assigned_to`. |
| Event_Vendor__c | `event_vendors` | `event_id`, `vendor_id`, `status`, `amount`, `confirmed`. |
| Account (Vendor record type) | `vendors` | Discriminator not needed as a separate record type — vendors get their own table instead of sharing `accounts`. `verification_status`, `primary_category`, `created_by`. |
| Vendor_Service__c | `vendor_services` | `vendor_id`, `name`, `description`. |
| Vendor_Claim_Request__c | `vendor_claim_requests` | `vendor_id`, `status`, `notes`, `reviewed_by`, `reviewed_at`, `rejection_reason`. Partial unique index enforces one Approved per vendor. |
| Vendor_Team_Invite__c | `vendor_team_invites` | `vendor_id`, `invited_email`, `role`, `status`. |
| AccountContactRelation | `vendor_team_members` | `vendor_id`, `user_id`, `role` (owner/manager/staff), `is_active`. |
| Vendor_Quote__c | `vendor_quotes` | `event_vendor_id`, `amount`, `status`, `valid_until`, `document_url`. Partial unique index: one Accepted per `event_vendor_id`. |
| Payment_Plan__c | `payment_plans` | `event_vendor_id`, `total_amount`, `deposit_amount`, `deposit_due_date`, `status`. |
| Payment_Installment__c | `payment_installments` | `payment_plan_id`, `installment_number`, `due_date`, `amount`, `status`, `paid_on`, `payment_gateway`, `gateway_transaction_id`. CHECK/trigger keeps sum ≤ plan total. |
| Payment_Reminder__c | `payment_reminders` | `payment_installment_id`, `remind_at`, `method`, `sent`. |

**Invariant enforcement** (was Apex trigger "backstops"): use **partial unique indexes** and **CHECK constraints** at the DB level in addition to app-level checks — e.g. `CREATE UNIQUE INDEX ON vendor_quotes (event_vendor_id) WHERE status = 'Accepted'`. This is strictly better than the Salesforce version: it's synchronous and unconditional, no async recalculation lag to work around.

---

## Authorization Model Port (Sharing → RLS)

- **Owner-only until shared** (`events`, `vendors`): default-deny RLS policy, `USING (owner_id = auth.uid())`, then an additional `OR EXISTS (SELECT 1 FROM event_collaborators WHERE event_id = events.id AND user_id = auth.uid())` clause — a direct translation of `EventSharingManager`'s explicit-grant-on-invite-accept pattern.
- **Vendor team visibility** (`event_vendors` visible to the vendor's whole active team): RLS policy joining through `vendor_team_members` — same shape as `EventVendorSharingManager`, but computed live on every query instead of snapshotted at association time. This is a real improvement over the documented Salesforce limitation ("a teammate added after a booking already existed won't see it") — carry over the fix, not the bug.
- **Guest/public access** (published events, vendor directory): a plain RLS policy for `anon` role, `USING (status = 'Published' AND visibility = 'Public')` — no async Guest User Sharing Rule recalculation to reason about at all, a direct simplification.
- **Guest writes** (RSVP): keep the "narrow allow-listed DTO, not raw table access" principle from `GuestRsvpRequest` — implement as a Server Action or API route with an explicit small input shape, using the Supabase service role internally, never a client-side anon INSERT policy on the raw table.
- **Role-tiered vendor permissions** (Owner > Manager > Staff): a small `assertVendorAccess(vendorId, minRole)` helper (direct port of `UserContextService.assertVendorAccess`) called at the top of every vendor-scoped Server Action, re-checked per call — same stateless-per-call philosophy as the Apex version, not cached in a session.

---

## Screen/Route Inventory (LWC epics → Next.js routes)

| Area | Routes | Carries over from |
|---|---|---|
| Guest/shared | `/`, `/vendors`, `/vendors/[id]`, `/events/[id]` | `gatherHome`, `gatherVendorDirectory`, `gatherVendorProfile`, `gatherEventDetail` — **this time, `/` must branch on auth state** (never done in the LWC build). |
| Onboarding | `/register`, `/onboarding/planner`, `/onboarding/vendor` | `gatherRegisterCredentials`, `gatherPlannerProfileSetup`, `gatherVendorRegistration` — Supabase Auth removes the license blocker entirely. |
| Planner — events | `/events`, `/events/new`, `/events/[id]/edit`, `/events/[id]/attendees`, `/events/[id]/tasks` | `gatherMyEvents`, `gatherEventWizard`, sub-sections of Event Detail. |
| Planner — vendors/commerce | `/events/[id]/vendors`, `/events/[id]/payments`, `/vendors/add`, `/vendors/[id]/claim` | `gatherAddVendor`, `gatherVendorClaim`, `gatherEventVendors`, `gatherEventPayments`. |
| Vendor persona | `/vendor/[vendorId]/dashboard`, `/vendor/[vendorId]/team` | `gatherVendorDashboard`, `gatherVendorTeam`. |
| Shared | `/profile`, persona switcher in the top-level layout | `gatherProfile`, `gatherPersonaSwitcher` — becomes React Context/Zustand store instead of LMS (fixes the documented "late subscriber never gets initial publish" bug by using reactive state instead of one-shot events). |

Design system: Tailwind theme file carrying the confirmed OKLCH tokens (`--primary` magenta, `--secondary` golden-yellow, pill-shaped 999px radii, 2px borders, Fredoka + Nunito via `next/font`) straight over from `gather-bold-playful.html` — no CSP/font-hosting problem exists in this stack, so that whole Salesforce-specific workaround disappears.

---

## What becomes moot (Salesforce-specific, does not carry over)

Account-creation license restriction; `Gather_Member_Access` permission-set-assignment gap; Person Account self-edit sharing errors; `RunSpecifiedTests` coverage fragility; LWR CSP font-loading workaround; LMS late-subscriber replay bug; `DigitalExperience`/`ExperienceBundle` metadata retrieval quirks. None of these exist once there's no Salesforce sharing/licensing/permission model underneath.

## What must actually get fixed this time (universal, carries forward as real product work)

Guest home not branching on auth state; RSVP validation robustness; URL not reflecting current tab/view (a router now makes this free, not extra work); bare `R{amount}` string formatting → real `Intl.NumberFormat` currency formatting; vendor-team "snapshot at association time" sharing semantics (fix via live RLS join, above); claim approve/reject needs a minimal back-office UI (was deliberately out of scope before — decide if still deferred); notification preferences need an actual schema (never existed); and — called out explicitly because it never happened once across 22 LWC bundles — **this rebuild should have real component/integration tests from the start** (Vitest + React Testing Library), not deferred to "later."

---

## Build Phases

| # | Phase | Contents | Depends on |
|---|---|---|---|
| 0 | Scaffolding | Next.js app, Supabase project, Drizzle schema + migrations for the full table set above, RLS policies for owner/guest baseline, Supabase Auth wired, Vercel deploy of an empty shell. | — |
| 1 | Design system | Tailwind theme from tokens, `next/font` Fredoka+Nunito, base component primitives (button, input, card) matching the prototype's pill/2px-border language. | 0 |
| 2 | App shell & cross-cutting state | Root layout, bottom tab bar (auth/persona-aware), session context, persona-switcher store, toast system. | 0, 1 |
| 3 | Guest & public browse | `/`, `/vendors`, `/vendors/[id]`, guest RSVP on `/events/[id]` — exercises the public RLS policies first, same "riskiest part first" sequencing as the original plan. | 2 |
| 4 | Registration & onboarding | Supabase Auth signup, planner + vendor onboarding continuations. | 2 |
| 5 | Planner core: events | Events CRUD, wizard, attendees, tasks. | 4 |
| 6 | Vendor directory & claims | Add vendor (search + stub), claim submission. | 3, 4 |
| 7 | Commerce | Quotes, payment plans/installments, Stripe integration. | 5, 6 |
| 8 | Vendor persona | Dashboard, team management, live-RLS team sharing fix. | 4, 2 |
| 9 | Polish & hardening | Notification schema, currency formatting, admin claim approve/reject, accessibility pass, Vitest/RTL coverage across all phases. | all |

---

## Verification

Each phase: deploy to a Vercel preview branch against a Supabase branch/dev database, exercise manually in a real browser (not just curl — a real gap in the old build), and add Vitest/RTL tests for the components and Server Actions built in that phase before moving on. Data-model invariants (one Accepted quote, one Approved claim, installment sum ≤ plan total) get a direct SQL test against the constraints, not just app-level assertions.

**Mobile-first real-device testing** (this is a bottom-tab-bar, mobile-first product — desktop devtools emulation is not sufficient on its own): during active development, run `npm run dev:mobile` (binds to `0.0.0.0`) and hit `http://<pc-local-ip>:3000` from a phone on the same Wi-Fi for live-reload testing; when that's blocked (cellular data, network client isolation, or a flow needing real HTTPS such as an auth redirect) use a tunnel (Cloudflare Tunnel / ngrok) for a real `https://` URL to the local server. Once deploying regularly, each Vercel preview URL doubles as the real-device test target and should be opened on an actual phone, not just resized in a desktop browser, before a phase is considered verified — specifically checking iOS Safari's `100vh`/viewport-height quirks and safe-area insets around the fixed bottom tab bar, which devtools emulation does not reliably surface.

---

## Local environment setup log

- **2026-09-12**: Repo scaffolded at `C:\Dev\Eventio\gather-web` via `create-next-app` (TypeScript, Tailwind, App Router, ESLint). Installed `drizzle-orm`, `drizzle-kit`, `postgres`, `@supabase/supabase-js`, `@supabase/ssr`, and the `supabase` CLI as project dependencies. Vercel CLI installed globally. Chose the **full local Docker + Supabase CLI stack** for local Postgres/Auth (over a cloud-only dev project) — this requires Docker Desktop, which in turn requires WSL2, both needing Administrator privileges to install. Docker Desktop additionally needs CPU virtualization enabled in the BIOS/UEFI firmware (a separate setting from WSL2 itself — Windows reports it via `systeminfo`'s "Virtualization Enabled In Firmware" line). See root `README.md` for the one-time setup commands.

- **2026-09-12 (later same day): full Phase 0 schema + RLS baseline built and verified against the real local stack**, not just type-checked. What shipped:
  - All 15 tables from the Data Model Port table above, in `src/db/schema.ts`, using Drizzle's `pgEnum`/`pgTable`/`index`/`pgPolicy` and the `drizzle-orm/supabase` helpers (`authUid`, `authenticatedRole`, `anonRole`). Every table has `.enableRLS()` — deny-by-default, matching Salesforce's Private OWD posture — with real policies on `events`, `event_collaborators`, `vendors`, `vendor_team_members`, and `event_vendors` (the Phase 0 "baseline" scope); every other table is locked to service-role-only until its owning feature phase adds policies.
  - Indexes on every foreign-key column an RLS policy actually filters/joins on (`events.owner_id`, both `event_collaborators` FKs, `vendors.created_by`, both `vendor_team_members` FKs, both `event_vendors` FKs) — Postgres doesn't auto-index FK columns, and RLS policies run `EXISTS` subqueries on exactly these columns on every request.
  - A Postgres trigger (`supabase/migrations/00000000000001_profiles_on_signup.sql`) that creates a `public.profiles` row automatically whenever `auth.users` gets a new row via Supabase Auth signup, plus a `profiles.id → auth.users.id ON DELETE CASCADE` foreign key Drizzle can't express (it doesn't manage the `auth` schema).
  - Four `SECURITY DEFINER` SQL helper functions (`supabase/migrations/00000000000002_rls_helper_functions.sql`: `is_event_owner`, `is_event_collaborator`, `is_vendor_creator`, `is_vendor_team_member`) that every cross-table policy now calls instead of inlining `EXISTS` subqueries against another RLS-protected table.
  - The Next.js side of Supabase Auth: `src/lib/supabase/{client,server,middleware}.ts` (browser client, Server Component/Action client, session-refresh helper) and `src/proxy.ts` — note **`proxy.ts`, not `middleware.ts`**: Next.js 16 renamed the middleware file convention to "Proxy" (same mechanism, same `matcher` config, exported function renamed from `middleware` to `proxy`); starting a project on 16.3.5 should use the new name from day one rather than build on something already deprecated.
  - `npm run build` passes cleanly (no deprecation warnings, no type errors) and a real signup → trigger → profile row chain was proven against the running local Auth API, not just asserted.

  **Three real bugs found and fixed by testing through the actual enforcement path, not just structurally inspecting the schema — this is the reason none of this was declared "done" after the first `drizzle-kit push` succeeded without error:**
  1. **`drizzle-kit push` silently drops RLS policy conditions.** After pushing the full schema, `pg_policies.qual`/`with_check` were `NULL` for every single policy — `push` diffs live against the DB via introspection rather than executing the generated SQL file verbatim, and has a real bug serializing policy expressions through that path (confirmed by comparing against `drizzle-kit generate`'s output, which had the correct SQL all along). **Fix: never use `db:push` once RLS policies exist — use `db:generate` then `db:migrate` instead**, which applies the migration file's SQL directly. `db:push` is now a hard-failing script in `package.json` with a pointer back here, specifically so this can't be silently reintroduced later. The very first migration had to be applied by hand (`node -e` running the raw SQL, since `drizzle-kit migrate` didn't yet have a tracking-table row for it) and then retroactively marked as applied in `drizzle.__drizzle_migrations` (hash = sha256 of the migration file's exact bytes, `created_at` = the journal's `when` value) so `db:migrate` would treat it as a baseline going forward.
  2. **"infinite recursion detected in policy" (Postgres error 42P17).** `events`' SELECT policy queried `event_collaborators` to check for an accepted invite; `event_collaborators`' own SELECT policy queried `events` back to check for ownership — two tables whose RLS policies reference each other form a cycle, since evaluating either table's policy requires re-evaluating the other's. The same cycle existed independently between `vendors` and `vendor_team_members`. **Fix: route every cross-table (and self-referencing) RLS check through a `SECURITY DEFINER` SQL function** (the four functions listed above) — such a function's internal query runs as the function's owner, which bypasses RLS, breaking the cycle. This is a general Postgres/Supabase RLS rule, not something specific to a mistake in this schema: any time two tables' policies reference each other, or a table's policy references itself, this same fix applies.
  3. **`DROP SCHEMA public CASCADE` (used once, mid-debugging, to get a clean slate) wipes Supabase's own baseline grants on that schema**, not just the tables in it — `anon`/`authenticated`/`service_role` lost table-level SELECT/INSERT/UPDATE/DELETE entirely, producing a confusing "permission denied for table events" *after* the RLS fixes above were already correct (RLS only ever restricts further; it can't grant access a role doesn't already have at the privilege level). Restored via the standard Supabase grants, saved in `supabase/migrations/00000000000003_restore_public_grants.sql` for the record. **Lesson: never `DROP SCHEMA public` on a Supabase-managed Postgres instance — use `supabase db reset` for a genuine clean slate**, which reruns Supabase's own initialization (grants included) plus everything under `supabase/migrations`.

  **How this was actually verified** (via the real REST API with real user JWTs, not the Postgres superuser connection used for setup — a superuser bypasses RLS entirely, so querying through it proves nothing about enforcement): created two real users via the local Auth API, had User A create a draft/private event, confirmed User B and an anonymous request both got `[]` back, confirmed User A could read their own event, confirmed User B's attempted `PATCH` affected zero rows, published the event as User A, confirmed the anonymous request could now see it. Separately proved the `vendors`/`vendor_team_members` bootstrap case: User A self-registers a vendor and inserts themselves as its first Owner team member (the exact chicken-and-egg shape that broke the Salesforce build), confirmed User B cannot insert themselves as Owner on A's vendor, confirmed User A (now Owner) can add User B as Staff.

- **2026-09-12 (Phase 1: Design System Foundation) — done and verified in a real browser, not just built.** `src/app/globals.css` now carries the full OKLCH token set ported verbatim from `project/prototypes/gather-bold-playful.html` (the confirmed design direction) via a Tailwind v4 `@theme inline` block; `src/app/layout.tsx` loads Fredoka (display) and Nunito (body) through `next/font/google` — which self-hosts them automatically at build time, so the prototype's Google Fonts `@import`/CSP problem from the original Salesforce-era plan simply doesn't exist in this stack, nothing to port. Added `src/components/ui/{button,input,card}.tsx` as the first base primitives (pill-shaped buttons in primary/secondary variants, a bordered field-radius input, a card), plus `src/lib/utils.ts`'s `cn()` helper (`clsx` + `tailwind-merge`). Verified with Playwright against the real running dev server (not just a clean build): screenshotted `src/app/page.tsx`'s style-proof content, confirmed via computed styles that the `<h1>` actually resolves to `Fredoka, "Fredoka Fallback"` and the primary button/background actually resolve to the intended OKLCH colors (not browser defaults), and confirmed zero console errors. Screenshot matched the prototype's visual language (pill buttons, soft badge pills, rounded cards) directly.

- **Still open for Phase 0**: a Vercel deploy of the empty shell. `vercel whoami` shows the CLI is logged out — logging in (`vercel login`) is an interactive, browser-based step tied to a personal Vercel account, so it needs to be run by Andre directly rather than by Claude. Once logged in, the remaining steps (`vercel link`, then a deploy) are quick.
