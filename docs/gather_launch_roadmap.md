# Gather — Launch & Native Apps Roadmap

**Status:** Planning, started 2026-09-24. This is a living document: tick items off and add notes as each epic moves. It's the companion to `gather_web_epic_roadmap.md` (the original build phases 0–10, all done) and `gather_web_architecture.md` (stack, data model, RLS, and the dated engineering log).

**Go-live is gated on Andre.** Nothing in this roadmap puts the site in front of real users. Every epic up to L11 prepares QA and production *without* opening sign-ups or announcing anything. L11 only happens when Andre says so. Until then, production (once it exists) runs with sign-ups paused, using the kill switch at `/admin/settings`.

## ▶ Where to pick up (updated 2026-09-25)

**State:** `main` and `develop` are both at `b629b2f` on GitHub. The local stack is fully migrated (0000–0056). Nothing is live; go-live waits for Andre (L11).

**L0 is done in the working tree but NOT committed.** The work is on the branch `chore/l0-baseline` (created off `develop`):
- the ten test suites, now proper Playwright tests: `npm run e2e` (all 10 pass), with a shared harness that fails on any check (`e2e/`, `playwright.config.ts`, `e2e/README.md`)
- `.github/workflows/ci.yml`: typecheck, lint, unit tests and build on every PR and on pushes to `main`/`develop`. The same steps pass locally with the CI placeholder environment.
- `.gitattributes` (line endings) and `.gitignore` (`/e2e/.output`)
- lint now has **0 errors** (the old `admin/event-types` quotes, plus two inline-edit forms that called `setState` inside an effect; both forms are now covered by the smoke suite)
- Vitest excludes `e2e/`
- this roadmap

**Next, in order:**
1. **Commit L0** on `chore/l0-baseline` (Andre to OK), push it, and open a PR into `develop` so the CI workflow runs on GitHub for the first time. Watch that first run: it hasn't executed on GitHub yet, only locally.
2. **Andre, in GitHub → Settings → Branches:** protect `main` (require a PR and the "checks" job to pass) and ideally `develop` too. `gh` isn't installed, so this can't be done from here.
3. **Then L1** (monorepo restructure). It moves every file, so do it right after this merge, while nothing else is in flight.

**Known gaps**
- The e2e suites aren't in CI yet: they need a seeded database (test accounts, "Dr Dre DJ", categories, event types). Writing that seed script is part of L2 ("QA seed data"); once it exists, add an e2e job to `ci.yml`.
- `npm audit`: **0 vulnerabilities in production dependencies**. 6 moderate ones exist in dev tooling only (vitest / esbuild / drizzle-kit chains), already present before Playwright was added; fixing them needs major-version upgrades, so revisit at a quiet moment.

**Still waiting on Andre:** the 8 decisions in "Decisions still needed from Andre" below. None block L1.

## Context

The website works end to end on the local stack. The goals now are:

1. **Native iOS and Android apps** that run alongside the website, share the same database and feel almost the same.
2. **Proper environments**: local, **QA** for testing changes, and **production**.
3. **One careful launch**, with nothing left to discover after going live.

### Decisions already made (2026-09-24)

| Topic | Decision | Why |
|---|---|---|
| Native approach | **Expo (React Native)**: one TypeScript codebase that builds both iOS and Android | Genuinely native, so Apple is unlikely to reject it as "a website in a box". Andre's React/TypeScript knowledge carries over, and Expo's cloud service (EAS) builds and submits both apps, so no Mac is needed. A Capacitor wrapper around the live site was rejected: Apple rejects thin wrappers, and it breaks offline. |
| Repos | **One repo (monorepo)**, this one (`AndreJPietersen/gather-web`), restructured into `apps/web`, `apps/mobile` and `packages/*` | One change can update web and apps together, and there's no copying between repos. |
| Databases | **Two hosted Supabase projects** (QA and production) plus the existing local stack | QA gets real-world testing without touching real users' data. |
| Website hosting | **Vercel** | Production from `main`, plus an automatic preview URL for every branch or pull request, pointed at the QA database. |
| App builds | **Expo EAS** (Build + Submit + Update) | Cloud builds for both platforms, TestFlight / Play upload, and small over-the-air fixes. |
| Admin console | **Stays web-only** | Desktop-oriented by design; nothing for the store apps to gain. |
| Location | **Mapbox** for maps and address search, plus **PostGIS** in Supabase for "near you" queries (epic L13) | Andre's choice (2026-09-24), to grow into "vendors near you" and location sharing. PostGIS is free and built into Supabase, so distance searches run in the database and obey the same RLS. |

### How the native apps reach the data

The apps talk **directly to Supabase**, just as the website's browser code does. Because every rule now lives in the database (RLS, field-level column grants, rate limits, triggers; see teachAndre/26 and the 2026-09-24 security review), **the apps inherit exactly the same protections automatically**.

The catch is **Server Actions**. They only exist inside the Next.js website, and a native app can't call them. The actions that do more than a single RLS-protected write need an **API** the app can call (epic L4). The inventory below is from 2026-09-24.

| Needs the API (uses the service role, or multi-step server logic) | Fine calling Supabase directly (RLS-protected) |
|---|---|
| Vendor onboarding (owner limits, first-owner insert) | Events, attendees, tasks, budget CRUD |
| Featured-spot requests / withdraw | Gallery / mood board metadata (uploads go to Storage directly) |
| Guest RSVP (`events/[id]/actions.ts`) | Vendor quotes (send / suggest / accept) |
| Vendor category-change clash check (`vendor/[id]/edit`) | Team notes, review replies, reviews |
| Support case + attachment (`profile/cases/new`) | Chat messages (Realtime works in React Native) |
| Business exception requests | Profile, notification preferences |
| Reminder sending (and push, L8) | Claims, invites (accept/decline) |
| Anything that sends email | Vendor services, social links |
| Unsubscribe (stays a web page) | |

## Epics

Sizes are relative (S / M / L / XL), not time estimates. Epics are listed roughly in order; see Dependencies.

### L0 — Safe baseline & repo hygiene (S)
Before anything moves, lock in what works.
- [x] Commit the current uncommitted work — done 2026-09-24 as `b629b2f` on `main` (146 files), pushed to GitHub.
- [x] Branch strategy (`develop` created and pushed 2026-09-24):
  - `main` = production-ready.
  - `develop` = what QA runs.
  - Feature branches get pull requests (PRs) into `develop`.
- [ ] GitHub branch protection on `main`: PR required, checks must pass.
- [x] Add a `.gitattributes` so line endings stay consistent on Windows (git currently warns LF→CRLF on every commit).
- [x] **GitHub Actions CI** (`.github/workflows/ci.yml`, added 2026-09-25) on every PR: `tsc`, `eslint`, `vitest`, `next build`. Fix the known pre-existing lint errors (`admin/event-types/page.tsx`) so CI starts green.
- [x] **Bring the end-to-end test suites into the repo** (2026-09-25). `e2e/scripts/*.mjs` run as Playwright tests via `npm run e2e` (`e2e/suites.spec.ts`, `playwright.config.ts`), with a shared harness that fails on any check. `@playwright/test` is a dev dependency. Running them in CI needs seeded test data (see L2).
  *Original note:* *Copied into `e2e/scripts/` on 2026-09-24 and verified running from there; still to convert to `@playwright/test` and wire into CI.* The exploit suite, the stranger "who can edit" sweep, and the feature suites (business rules, moderation, staff, email) currently live only in a temporary scratchpad and would be lost. Move them into `e2e/` as Playwright tests runnable against local or QA.

### L1 — Monorepo restructure (M)
- [ ] npm workspaces + **Turborepo**. Layout:
  - `apps/web`: today's Next.js app, moved unchanged.
  - `apps/mobile`: the Expo app, added in L6.
  - `packages/db`: Drizzle schema and migrations, plus generated Supabase TypeScript types.
  - `packages/shared`: pure logic both apps use:
    - business rules (`vendor-business-rules`, `feature-pricing`, `feature-placements`, `vendor-ranking`, `upcoming`, `vendor-completion`)
    - zod schemas
    - email rendering (`lib/email/*`)
    - formatting (`formatZAR`, dates)
    - FAQ content
  - `packages/tokens`: the three colour themes as data. The web's CSS uses `oklch`; the app needs hex/RGB values, which `brand.ts` already shows how to produce.
  - `supabase/` stays at the root.
- [ ] Vercel project root becomes `apps/web`.
- [ ] Verification: the website behaves identically, and every test plus the e2e suites pass after the move.

### L2 — Environments: QA and production (M)
- [ ] Create two Supabase projects, **gather-qa** and **gather-prod**.
  - Region: closest to South Africa. Check Cape Town availability; otherwise Europe (Frankfurt or Ireland).
  - Plans: production on **Pro** (daily backups, no pausing), QA on Free.
- [ ] One **migration procedure** for both migration folders (`supabase/migrations` raw SQL, which includes the storage buckets, and `src/db/migrations` Drizzle). Document it in the architecture doc. Run it through a GitHub Action:
  - QA migrates automatically on merge to `develop`.
  - Production migrates on merge to `main`, **with a manual approval step**.
- [ ] Supabase Auth settings per project:
  - site URL and redirect URLs
  - email confirmations **on**
  - branded auth emails, reusing the Gather layout from L3
  - custom SMTP through Resend
  - **CAPTCHA**, e.g. Cloudflare Turnstile (the biggest remaining bot/abuse gap)
  - auth rate limits reviewed
- [ ] Vercel:
  - **Production** environment → gather-prod.
  - **Preview** environment (every branch/PR) → gather-qa.
  - Environment variables per environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SITE_URL`, `EMAIL_UNSUBSCRIBE_SECRET`.
  - Vercel **Pro**, because commercial use isn't allowed on Hobby.
- [ ] **QA seed data**: the service categories, event types and email templates that migrations don't seed, plus realistic demo planners, vendors, events and bookings, and fixed QA accounts (planner, vendor owner/manager/staff, admin).
- [ ] **Production bootstrap**: reference data only (no demo data), the first admin account flagged by hand, **sign-ups paused**, **featured vendors off**.
- [ ] Domain: buy it, point it at Vercel, set up the Resend sending domain (SPF/DKIM/DMARC), and use a `qa.` subdomain for QA.

### L3 — Launch readiness: web (M)
Things the website needs before any real user (and which the stores also require):
- [ ] **Account deletion**: in-app "Delete my account" on Profile, which Apple requires. Decide what happens to the account's data:
  - events they own: delete them, or transfer them?
  - businesses they own alone: hide or delete them.
  - reviews: anonymise them.
  - payment records: keep what's needed for the other party.
  - Finish with the Supabase Auth user deletion.
- [ ] **Privacy policy** and **terms of use** as public pages, linked from the footer, register page and app stores.
- [ ] **POPIA**:
  - a consent line at sign-up
  - a named information officer
  - "what we store and why"
  - a data export on request (can be admin-assisted to start)
- [ ] Branded **Supabase Auth emails** (confirm sign-up, reset password, magic link) matching the new Gather email layout.
- [ ] **Password reset flow**. Check whether it exists end to end, and build it if not.
- [ ] Error monitoring (e.g. **Sentry**) for web and, later, mobile, plus Vercel Analytics or a privacy-friendly alternative.
- [ ] Friendly **404 / error pages**, SEO basics (titles, Open Graph images, `robots.txt`, a sitemap for public events and vendors).
- [ ] Re-run the security suites (exploits, stranger sweep) against **QA**, not just local.
- [ ] Close the open items in `gather_web_epic_roadmap.md`: the OKLCH contrast failures, a real mobile-device pass, and the payments decision (Stripe was never wired; today tracking is manual).

### L4 — API for the native apps (M)
- [ ] Versioned **route handlers** at `apps/web/app/api/v1/*`, authenticated with the caller's Supabase access token (`Authorization: Bearer …`). The same guards apply: `getVendorAccess`, `requireAdmin` (admin endpoints aren't exposed at all), and the rate limits.
- [ ] Refactor each Server Action in the "Needs the API" column into a **shared service function**. The Server Action and the API route become thin wrappers, so there's one implementation and one set of rules.
- [ ] Consistent error format (reuse `friendlyWriteError`), with request validation by the shared zod schemas.
- [ ] Tests: each endpoint with no token, a stranger's token and the right token, added to the e2e suite.

### L5 — Shared package & typed data layer (S)
- [ ] Generate **Supabase TypeScript types** (`supabase gen types`) into `packages/db`, used by both apps. Today the web code types query results by hand with `.returns<…>()`.
- [ ] A shared Supabase client factory that works for web (cookies via `@supabase/ssr`) and mobile (session in `expo-secure-store`).
- [ ] Unit tests move with the code they cover.

### L6 — Mobile app foundation (L)
- [ ] `apps/mobile`: Expo (current SDK), **Expo Router** (file-based, like Next.js), TypeScript, NativeWind (Tailwind for React Native) using `packages/tokens`.
- [ ] Brand:
  - app icon and splash from the tent mark (the `renderIconMark` artwork)
  - the three themes
  - fonts: Fredoka, Nunito, and Dancing Script for the wordmark
- [ ] **Auth**: log in, register, onboarding, and "Who are you today?", mirroring the web. The session persists in secure storage.
- [ ] Navigation mirroring the web tab bars: guest / planner / vendor, with the persona switcher.
- [ ] Config per channel (development / QA / production) for Supabase URL and keys. EAS build profiles: `development`, `preview` (QA), `production`.
- [ ] **Deep links**: iOS universal links and Android app links, so a Gather link (event invite, RSVP, vendor page) opens the app if it's installed and the website if not.

### L7 — Mobile feature parity (XL, split into four)
Rebuild the user-facing screens natively, reusing shared logic. The admin console is excluded.
- [ ] **L7a — Public and shared**: home, the vendors marketplace with filters and featured row, vendor detail (gallery, reviews), FAQ, profile (edit, notifications, persona switch, report an issue and cases), "Add a business".
- [ ] **L7b — Planner**: my events, new/edit event, the event page (countdown, Help Me Plan), attendees and RSVP, tasks, budget, event vendors (quotes: accept/decline), payments (plans, installments, proof of payment via the camera or photo library), mood board, gallery, chat (Realtime, attachments).
- [ ] **L7c — Vendor**: dashboard, bookings (quotes, staff suggestions, team notes), payments (owner/manager), gallery, services, social links, reviews and replies, team (owner), featured (owner), edit business and logo.
- [ ] **L7d — Parity pass**: a side-by-side review of every web screen against its app screen, plus accessibility (screen reader labels, dynamic type) and small-screen/tablet layouts.

### L8 — Native-only capabilities (M)
- [ ] **Push notifications** (Expo Notifications; APNs for iOS and FCM for Android via EAS credentials):
  - a `device_push_tokens` table
  - payment and task reminders delivered as push *and* email, respecting preferences
  - a new chat message pushes to the other side
  - quote received / accepted
  - invite received
- [ ] Server-side push sending: move reminders off "fires when someone opens the app" (the current implicit trigger) to a **scheduled job**, now needed anyway. That means Supabase Cron + an Edge Function, or a Vercel Cron → API route.
- [ ] Camera and photo library for uploads, the share sheet (share an event invite link), and "Add to calendar" for an event.
- [ ] Offline basics: cached last-viewed data with a clear offline banner. No offline editing in v1.

### L9 — QA process (M, ongoing)
- [ ] A **written test plan**: core journeys per persona (planner, vendor owner/manager/staff, guest, admin), run on web and both apps before each release.
- [ ] **Automated**:
  - CI (L0)
  - the Playwright e2e suite against QA on every merge to `develop`
  - mobile end-to-end flows with **Maestro** on the key journeys (log in, create event, chat, quote)
- [ ] **TestFlight** (iOS) internal testing, then external testers once Apple's beta review passes.
- [ ] **Google Play internal testing**, then a **closed test**. A *personal* developer account must run a closed test with **at least 12 testers for 14 continuous days** before production access. Start this early, or register as an organisation (see Decisions).
- [ ] A bug triage flow: GitHub Issues with labels (web / ios / android / backend, severity).

### L10 — Store submission (M)
- [ ] **Apple App Store Connect**: the app record, bundle ID, name/subtitle/keywords, screenshots (6.7" and 6.5" iPhone, plus iPad if supported), privacy "nutrition labels", age rating, export compliance, review notes with a **demo account**, support URL, and privacy policy URL.
- [ ] **Google Play Console**: listing, screenshots and feature graphic, **Data safety** form, content rating questionnaire, target API level, app signing through Play.
- [ ] **Payments policy check**: nothing is charged in the app today, which is good. If featured spots ever become payable, pay outside the apps, or expect Apple/Google to require their in-app purchase system (15–30% fee) for digital goods.
- [ ] Apple's review usually takes 1–3 days and can reject; budget a resubmission.

### L11 — Go-live (S) — **only when Andre says so**
- [ ] Final production checklist:
  - migrations applied and verified
  - security suites pass against production (read-only checks)
  - backups on
  - monitoring on
  - admin accounts set
  - email domain verified
  - legal pages live
- [ ] Open sign-ups (the `/admin/settings` switch). Keep featured vendors off until the marketplace has enough vendors.
- [ ] Release the apps. Use a **staged rollout** on Google Play (e.g. 10% → 50% → 100%), and Apple's phased release.
- [ ] A **rollback plan**:
  - Vercel instant rollback for web
  - EAS Update rollback for app JavaScript
  - a database migration rollback note per release
- [ ] Watch errors, sign-ups and the admin watchlist daily for the first two weeks.

### L13 — Location: "vendors near you" and location sharing (L)
Mapbox for maps and address search; PostGIS for distance. Web first, then the apps. **Must land before go-live (L11)** if it's part of v1.

**Data model**
- [ ] Enable the **PostGIS** extension, in a migration.
- [ ] **Events** get a proper venue: `venue_name`, a formatted `venue_address`, a `venue_point` (geography), and a `place_id` from the geocoder. The free-text `location` is kept for old events. Planners pick the venue from an address search, not free typing.
- [ ] **Vendors** get a service area: a `base_point` plus `service_radius_km`, or "nationwide", plus a display label such as "Cape Town & surrounds".
  - A home-based business shouldn't have to publish its street address. The public point is **rounded to suburb/area level**. An exact address is optional, and visible only to the vendor team and admins (column grants, same approach as phone numbers).
- [ ] A `vendors_near(lat, lng, radius_km, category)` database function using a spatial index. It returns vendors whose service area covers the point, nearest first, and still respects hidden listings, verification and RLS.

**Features**
- [ ] **Address search** (Mapbox Search / Geocoding) on:
  - the event venue field (new/edit event)
  - vendor onboarding and edit ("Where are you based?", plus a radius slider)
- [ ] **Marketplace "Near my event" / "Near me"** filter and a sort by distance.
  - "Near my event" uses the event's venue.
  - "Near me" uses the device's location **only for that search, never stored**, and only after the person agrees to share it.
  - Distance labels such as "12 km away".
  - Default radius is **admin-editable** on `/admin/settings`.
- [ ] **Suggested vendors** on an event (Help Me Plan, the event's vendors page) are ranked by distance as well as category.
- [ ] **Maps**:
  - event page: a venue map with a "Get directions" button (opens Google Maps / Apple Maps / Waze)
  - vendor profile: a service-area map (a circle, not a pin on their house)
  - marketplace: an optional map view
- [ ] **Location sharing**:
  - the event's invite/RSVP page shows the venue map and directions to guests
  - "Share location" in event chat sends a venue or pin
  - live location sharing (e.g. "the vendor is on the way") is **out of scope for v1**, because it needs background location permissions, which Apple and Google review strictly
- [ ] **Mobile**: `@rnmapbox/maps` needs an Expo development build (not Expo Go). The cheaper alternative is Mapbox for search plus the phone's built-in maps (Apple Maps / Google Maps) for display. Decide at L6.
- [ ] Backfill: prompt existing vendors to set their area (a dashboard card, like "Complete your profile"). Map existing event `location` text through the geocoder where it matches confidently; otherwise ask the planner.

**Keys, privacy and stores**
- [ ] Mapbox tokens:
  - a **public token restricted to Gather's domains / app bundle IDs** for maps in the browser and app
  - a **secret token, server-side only**, for geocoding done on the server
  - separate tokens for QA and production
- [ ] Watch Mapbox's terms on **storing geocoding results**. Storing coordinates permanently in the database may require Mapbox's *permanent* geocoding (billed differently from the free temporary lookups). Confirm on Mapbox's pricing page before building, and design the save step around it.
- [ ] **POPIA**: location counts as personal information. Say what's stored (event venues, vendor areas) and what isn't (device location), in the privacy policy.
- [ ] **Store disclosures**:
  - Apple privacy labels and Google Data safety: "approximate/precise location, not stored" for "Near me".
  - An iOS permission-prompt text explaining why ("to find vendors near you").
  - Ask for location only **while the app is in use**, never in the background.

### L12 — Operations after launch (S, ongoing)
- [ ] Restore drill: actually restore a production backup into a scratch project once.
- [ ] Incident runbook: who to contact, how to pause sign-ups, how to hide a listing or suspend a user (the tools exist), how to roll back.
- [ ] Release rhythm: web continuously; apps as store releases for native changes, and EAS Update for JavaScript-only fixes.

## Dependencies

```
L0 ─► L1 ─► L2 ─► L3 ────────────────────────────┐
             │                                    ▼
             └─► L4 ─► L5 ─► L6 ─► L7 ─► L8 ─► L9 ─► L10 ─► L11 (Andre's call) ─► L12
```
L3 and L4–L7 can run in parallel once L2 exists. L9 starts as soon as there's a first internal build (early L7), not at the end. **L13 (location)** can start on the web right after L2, and its app screens are built alongside L7. It must be finished before L11 if "vendors near you" is part of v1.

## Decisions still needed from Andre

1. **Developer accounts: individual or organisation?** An organisation account shows a company name as the seller, and on Google Play it skips the 12-tester / 14-day closed test, but it needs a registered company and a free **D-U-N-S number** (can take 1–2 weeks). An individual account shows your own name.
2. **App name and IDs.** "Gather" is likely taken on both stores, so choose a store name (e.g. "Gather — Event Planner") and a permanent bundle ID (e.g. `com.<yourdomain>.gather`, which can never change once published).
3. **Domain name** for the website, email and deep links.
4. **Supabase region**, and whether production starts on Pro immediately (recommended once real data exists).
5. **Account deletion**: what happens to a deleted user's events, businesses and reviews (proposal in L3).
6. **Payments**: stay with manual tracking for v1 (recommended), or bring Stripe/PayFast into scope.
7. **Location in v1?** Should "vendors near you" (L13) be in the first release, or follow shortly after? Recommendation: in v1 for the web and apps, because it's a strong reason for a planner to use Gather over a search engine. Live location sharing stays out of v1.
8. **Maps in the apps**: full Mapbox maps (a consistent look everywhere, more setup) or Mapbox search plus the phone's own maps (cheaper, feels native). Decide at L6.

## Accounts and running costs (approximate, 2026)

| Service | Cost | Needed from |
|---|---|---|
| Apple Developer Program | US$99 / year | L6 (for device builds), L9 |
| Google Play Console | US$25 once | L9 |
| Supabase Pro (production) | ~US$25 / month | L2 (can start Free until real data) |
| Vercel Pro | US$20 / month | L2 |
| Expo EAS | Free tier; ~US$19 / month for more builds | L6 |
| Resend | Free to ~3k emails/month; paid beyond | L2 |
| Domain | ~US$10–20 / year | L2 |
| Sentry (optional) | Free tier | L3 |
| **Mapbox** (maps + address search) | Generous free tiers, then usage-based (below) | L13 |

### Mapbox costs in more detail

Mapbox bills by usage, with a free allowance every month. These are approximate 2026 figures; **confirm on mapbox.com/pricing before committing**, since they change:

| What Gather would use | Free each month | After that (roughly) |
|---|---|---|
| Web maps (Mapbox GL JS), per map load | ~50,000 loads | ~US$5 per 1,000 |
| Mobile maps SDK, per monthly active user | ~25,000 users | a few US$ per 1,000 users |
| Address search / temporary geocoding | ~100,000 requests | ~US$0.75 per 1,000 |
| **Permanent** geocoding (storing coordinates) | Check; may have no free tier | Billed per request |

For a new marketplace this should stay **within the free tiers for a long time**. Two things keep it that way:
- Only load a map where it's needed (the event page and vendor profile), not on every list.
- Save each venue's and vendor's coordinates once, instead of looking them up every time.

Set a **billing alert** in Mapbox from day one.

The alternative is Google Maps Platform (Places + Maps). It has comparable quality, a US$200-ish monthly credit, and stricter terms on showing results off Google maps. Mapbox is the better fit for a branded look.

## What to install on Andre's PC

Already there: Node, Git, VS Code, Docker Desktop, Supabase CLI.

To add, when each epic arrives:
- **L6**: **Android Studio**, for the Android emulator and SDK (Java is included).
- **L6**: **EAS CLI**, installed with `npm i -g eas-cli`.
- **L6**: the **Expo Go** app (or a development build) on your own iPhone and Android phone. That's how iOS gets tested without a Mac.
- **L0**: GitHub CLI (`gh`), optional but handy for pull requests.
- **L13**: nothing to install; just a Mapbox account and tokens (one set for QA, one for production).

## Progress log

- **2026-09-24**: added **L13 Location (Mapbox + PostGIS)** at Andre's request ("vendors near you" and location sharing), with Mapbox costs. Today events only have a free-text `location`, and vendors have no location at all. PostGIS is available in Supabase but not yet enabled.
- **2026-09-24**: roadmap written. Approach agreed: Expo, one monorepo, Supabase QA + production, Vercel for web, EAS for apps. Go-live deliberately not scheduled; it waits for Andre.
