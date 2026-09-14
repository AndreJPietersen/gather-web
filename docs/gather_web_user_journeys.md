# Gather Web — User Journeys

**Status:** Forward-looking. Unlike the Salesforce-era journey docs this one is rewritten from (`gather_apex_journey.md`, `gather_frontend_journey.md` — both recaps of *completed* work), almost none of this is built yet: only Phases 0 (scaffolding/RLS) and 1 (design system) are done. Each beat below is written as the intended experience, cited against the route, Server Action, and RLS policy/invariant that will make it real — update a beat's status inline as its phase ships, the same way the Salesforce docs were kept current as their build progressed.

_Companion docs: `gather_web_architecture.md` (the data model, RLS policies, and route inventory every beat below cites) and `gather_web_epic_roadmap.md` (which phase turns each beat into working software)._

---

## Part One: The Planner's Journey

She lands on `/` with nothing decided yet — not even an account. The home page shows her real public events and a teaser of verified vendors, because a guest can browse Gather before logging in. *(Route: `/`, branching on auth state per Phase 3's explicit requirement — a guest-safe query filtered to `status = 'Published' AND visibility = 'Public'`, the `anon`-role RLS policy on `events`.)*

She taps **Plan an Event**, enters an email and password, and submits. *(Route: `/register` → Supabase Auth signup, Phase 4 — no license tier, no per-login cost, unlike the Salesforce-era `Site.createExternalUser` path it replaces.)* She lands in the app shell and fills in her name and phone to finish onboarding. *(Route: `/onboarding/planner`, a Server Action writing to her own `profiles` row — the `profiles.id → auth.users.id` trigger from Phase 0 already created that row automatically on signup.)*

She creates her event — type, date, location, guest cap — and it starts life as a private Draft only she can see. *(Route: `/events/new`, a Server Action inserting into `events` with `owner_id = auth.uid()`; the owner-only RLS policy is what actually keeps it private, not application logic.)* Her fiancé needs to help plan, so she invites him as an Editor collaborator; he finds the invite waiting for him and accepts it. *(An `event_collaborators` row with `permission_level = 'editor'`, `status` moving `invited → accepted` — the RLS policy on `events` includes an `OR EXISTS (... event_collaborators ...)` clause specifically so an accepted collaborator can see an otherwise-private event, per the Authorization Model Port.)* She builds a task list and invites list, and a guest who was never asked to create an account can still RSVP from a shared link. *(Routes: `/events/[id]/tasks`, `/events/[id]/attendees`; guest RSVP is a Server Action with a narrow, explicit input shape using the Supabase service role internally — never a client-side `anon` INSERT policy on the raw table, per the Authorization Model Port's "guest writes" rule.)*

She browses `/vendors` for a photographer and finds one that isn't listed yet. Rather than give up, she searches first (the required dedupe step) and, finding no match, creates a lightweight stub — name, category, phone. It shows up marked **Unverified**. *(Route: `/vendors/add`, Phase 6 — see Vendor Directory Bootstrapping & Verification in the architecture doc.)* For vendors she does find, she associates each one with her event. *(An `event_vendors` row; the vendor's whole active team sees it immediately via the live RLS join through `vendor_team_members` — the deliberate fix for the Salesforce-era "snapshot at association time" bug, not a repeat of it.)*

Quotes start arriving from vendors who've claimed their listings. She reviews them and accepts the caterer's — any other quote on that relationship gets auto-declined in the same transaction, backstopped by the partial unique index so even a direct database edit can't sneak a second `Accepted` quote past it. *(Route: `/events/[id]/vendors`, Phase 7.)* With the caterer confirmed, she sets up a payment plan and installments; the platform won't let the installments exceed the plan total, whether through the normal flow or not. *(Route: `/events/[id]/payments`; installment-sum CHECK constraint from the Business Rules & Invariants table.)* As each payment comes due, a reminder goes out — the background-jobs mechanism (Supabase Edge Functions + `pg_cron`, or Inngest) replacing the Salesforce hourly Queueable. She marks the deposit paid the moment it clears.

---

## Part Two: The Vendor's Journey

He arrives already running a photography business, with two ways in. If Gather has never heard of his business, he registers fresh and becomes its Owner on the spot — no review needed, since there's no competing claim on a brand-new listing. *(Route: `/onboarding/vendor`, Phase 4 — the RLS/DB side of this exact self-registration-then-insert-self-as-Owner chicken-and-egg case was already proven working in the Phase 0 verification, using a `SECURITY DEFINER` helper function to avoid the RLS recursion the naive version would hit.)*

If a planner already stubbed his business, he finds it, submits a claim with a short verification note, and waits for review. *(Route: `/vendors/[id]/claim`, Phase 6.)* When an admin approves it, he becomes Owner in one motion — the vendor flips to Verified, and any competing pending claim is automatically rejected in the same transaction. *(The admin review screen is net-new work for gather-web — Salesforce used a Setup list view with no custom screen; see Outstanding Items in the epic roadmap.)*

As Owner, he fills out the business profile and lists what he offers. *(Route: `/vendor/[vendorId]/dashboard`, Phase 8 — service listings visible to anyone browsing `/vendors`, logged in or not.)* He brings his second shooter on as a Manager and his assistant on as Staff — Managers can quote and manage bookings, Staff can only view them, enforced by `assertVendorAccess(vendorId, minRole)` re-checked on every call, not cached in a session. *(Route: `/vendor/[vendorId]/team`, Owner-only.)* He can hold both identities at once — his own planner account and ownership of this business — and switch between them from the persona switcher built in Phase 2.

A planner associates his business with her event, and it shows up on his dashboard immediately — the live RLS join means he never has to be told, and a teammate added to his team *after* the booking already existed sees it too (the fix that never happened on the Salesforce side). He submits a quote; only Manager-tier and above can do that, so his Staff assistant can see the booking but not touch the price. If it's accepted, he sees the payment plan and installments building up, with running totals (quoted, paid, outstanding) computed by the database, not recalculated client-side.

---

## Part Three: Cross-Cutting Flows

**Guest → authenticated transition.** A guest browsing `/` or `/vendors` who signs up mid-session should land back where they were with the tab set now reflecting their new persona — the direct fix for the Salesforce build's "post-registration relies on a full page reload, not a live session republish" gap. Since gather-web's session state is a reactive Server Component read plus a Zustand store (Phase 2), not a one-shot LMS publish, this should be free rather than requiring a deliberate reload — confirm this is actually true once Phase 4 ships, rather than assuming the architecture is sufficient on its own.

**Persona switching.** A user with both a Planner identity and one-or-more Vendor personas switches via a pill row in the layout (Phase 2's Zustand store, Phase 8's UI) — every vendor-scoped Server Action re-derives and re-checks access for the *specific* vendor being acted on, exactly as `assertVendorAccess` does; the current persona is never trusted as a cached authorization decision.

---

## Part Four: Journey → Test Plan Seed

Each beat above cites a route, a Server Action or query, and an RLS policy/invariant — deliberately, so that once a phase actually ships, its beats can be lifted almost directly into concrete test cases, the same way `gather_functional_test_plan.md` restated the Salesforce journeys as testable steps (Section A Planner, Section B Vendor, Section C cross-cutting).

**Not built yet, and shouldn't be built now:** a full `docs/gather_web_test_plan.md` with a real test-case table. Most of the routes above don't exist — writing detailed manual test steps against UI that isn't there yet would drift out of date immediately. The right time to extract that doc is once a phase's routes are real, starting with Phase 3 (guest/public browse) since it's the first phase with actual pages to click through. When that happens, link it from `gather_web_architecture.md`'s Verification section alongside the existing Vitest/RTL and real-device testing requirements.
