# End-to-end & security suites

The suites that verify each feature and the 2026-09-24 security review. They
drive a **running app against a real Supabase stack**, so they're separate
from the unit tests (`npm test`).

## Running them

Prerequisites (local):
- the local Supabase stack: `npm run db:start`
- the dev server: `npm run dev`
- `apps/web/.env.local` filled in (the suites read the same Supabase URL and keys as the app)
- Playwright's browser, once: `npx playwright install chromium`
- the seeded local test accounts:
  - `vendortest@gather.dev` (owner of "Dr Dre DJ")
  - `phonetest@gather.dev` (admin)
  - password `GatherTest123!` for both

```
npm run e2e                 # everything, one suite after another
npm run e2e:security        # only the security suites
npm run e2e -- -g "email"   # any suite whose name matches
node e2e/scripts/security-exploits.mjs   # one suite directly, with its PASS/FAIL lines
```

Each suite prints `PASS`/`FAIL` lines and exits non-zero if anything failed;
`e2e/suites.spec.ts` runs each one as a Playwright test and attaches the full
output. They clean up the data they create, and put screenshots in
`e2e/.output/` (gitignored). They run **in order, one at a time**, because they
share one database and briefly change app settings.

To point them at another environment (e.g. QA): set `E2E_BASE_URL`,
`E2E_DB_URL`, `E2E_MAILPIT_URL` (email suite only) and the usual
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. **Never point them at production** — several
create and delete real rows and toggle app settings.

## The suites

| Script | Checks |
|---|---|
| `security-db-audit.mjs` | Guards: every public table has RLS, no views, anon can't write anywhere, nobody can TRUNCATE, no *unreviewed* `SECURITY DEFINER` function is callable by users, every bucket has a size limit. (A new callable function must be added to the reviewed list in the script, on purpose.) |
| `security-stranger-sweep.mjs` | A brand-new unrelated account tries to edit a row in *every* table and delete others' records — nothing may change. |
| `security-exploits.mjs` | 18 attacks through the public API (self-promotion to admin, phone dump, email enumeration, pre-verified listing, invite escalation, booking moves, forged claims/cases, event flooding, admin tables), with controls proving normal edits still work. |
| `smoke.mjs` | Everyday planner, vendor and admin pages load; event create/edit, profile phone, Settings forms save. |
| `featured-vendors.mjs` | Featured requests, pricing page, admin approval, on/off switch. |
| `business-rules.mjs` | Persona picker at login, owner limits, duplicate categories, exception request → approval. |
| `watchlist.mjs` | Watchlist signals, closed team-membership holes, function lockdown. |
| `moderation.mjs` | Daily listing cap, dismiss, hide/restore, suspend/lift, the sign-up kill switch. |
| `staff-permissions.mjs` | Vendor staff: suggestions, team notes, gallery add-only, money hidden; quote status rules. |
| `admin-email.mjs` | Templates, live preview, every audience type, delivery via Mailpit, unsubscribe, limits, security, a branded reminder. |

Shared plumbing (config, `check()`, login, exit codes) is in `lib/harness.mjs`.

## In CI

The `e2e` job in `.github/workflows/ci.yml` starts a throwaway local Supabase
stack, builds the database with `npm run db:migrate`, fills it with
`db:seed:reference` and `db:seed:demo`, builds and starts the app, and runs
`npm run e2e`. It is not a required check yet.

## Fresh local database

The suites assume the seeded accounts (`vendortest@gather.dev`,
`phonetest@gather.dev`, password `GatherTest123!`), a live featured vendor
that isn't Dr Dre DJ, and the reference data. To rebuild a clean copy of all of
that: `npm run db:stop`, delete the Supabase Docker volumes (or use a second
stack), `npm run db:start`, then `npm run db:migrate && npm run db:seed:reference && npm run db:seed:demo`.

## Launch-readiness suites (L3)

- `account-deletion.mjs` — the `delete_account` database function: what is erased, what is kept as "Deleted user", and that a signed-in user can't call it.
- `launch-readiness.mjs` — privacy/terms/robots/sitemap/404, the password-reset flow through the real email in Mailpit (checks the Gather layout), the bad-link guard, and deleting an account from the Profile page.
