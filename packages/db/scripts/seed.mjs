// Seeds a Gather database.
//
//   node scripts/seed.mjs reference    service categories, event types and the
//                                      event-type -> category mapping. Safe for
//                                      production (real data every environment
//                                      needs). Idempotent.
//   node scripts/seed.mjs demo         fake people, businesses and events for
//                                      local / CI / QA. NEVER production: it
//                                      creates accounts with a known password.
//                                      Idempotent (deterministic ids).
//   node scripts/seed.mjs all          reference + demo
//
// DATABASE_URL defaults to the local Supabase stack. Demo mode also needs
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (to create auth users
// through the Auth admin API, which hashes passwords the way GoTrue expects);
// they're read from the environment, falling back to apps/web/.env.local.
//
// Salesforce analogy: reference = the setup data you'd deploy with the metadata
// (picklists, record types); demo = a sandbox seed / data-loader load.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const mode = process.argv[2];
if (!["reference", "demo", "all"].includes(mode)) {
  console.error("Usage: seed.mjs reference | demo | all");
  process.exit(2);
}
const here = import.meta.dirname;
const repo = path.resolve(here, "../../..");
const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const host = new URL(url).hostname;
const isLocal = ["127.0.0.1", "localhost", "::1", "host.docker.internal"].includes(host);
const gatherEnv = process.env.GATHER_ENV ?? (isLocal ? "local" : "unknown");

if (!isLocal && !process.argv.includes("--remote")) {
  console.error(`Refusing to touch ${host}: not a local database. Re-run with --remote if intended.`);
  process.exit(2);
}
if (mode !== "reference" && !["local", "ci", "qa"].includes(gatherEnv)) {
  console.error(`Refusing to seed demo data: GATHER_ENV is "${gatherEnv}". Demo data is for local, ci and qa only.`);
  process.exit(2);
}

function loadEnv() {
  const file = path.join(repo, "apps", "web", ".env.local");
  const fromFile = fs.existsSync(file)
    ? Object.fromEntries(
        fs
          .readFileSync(file, "utf8")
          .split(/\r?\n/)
          .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
          .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
      )
    : {};
  return { ...fromFile, ...process.env };
}

const sql = postgres(url, { onnotice: () => {}, max: 1 });

// ---------------------------------------------------------------- reference
async function seedReference() {
  const data = JSON.parse(fs.readFileSync(path.join(here, "../seed/reference-data.json"), "utf8"));
  for (const name of data.serviceCategories) {
    await sql`insert into service_categories (name) values (${name}) on conflict (name) do nothing`;
  }
  for (const name of data.eventTypes) {
    await sql`insert into event_types (name) values (${name}) on conflict (name) do nothing`;
  }
  for (const [type, cats] of Object.entries(data.eventTypeServiceCategories)) {
    for (const cat of cats) {
      await sql`
        insert into event_type_service_categories (event_type_id, service_category_id)
        select t.id, c.id from event_types t, service_categories c
        where t.name = ${type} and c.name = ${cat}
          and not exists (select 1 from event_type_service_categories m where m.event_type_id = t.id and m.service_category_id = c.id)`;
    }
  }
  const [{ n }] = await sql`select count(*)::int n from event_type_service_categories`;
  console.log(`reference: ${data.serviceCategories.length} categories, ${data.eventTypes.length} event types, ${n} mappings`);
}

// --------------------------------------------------------------------- demo
const PASSWORD = "GatherTest123!";
// Deterministic ids: a fixed prefix plus a counter, so re-running updates rather than duplicates.
const id = (kind, n) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const U = (n) => id("a", n); // users
const V = (n) => id("b", n); // vendors
const E = (n) => id("c", n); // events

const USERS = [
  { n: 1, email: "vendortest@gather.dev", name: "André", admin: false },
  { n: 2, email: "phonetest@gather.dev", name: "Phone Test", admin: true },
  { n: 3, email: "planner@gather.dev", name: "Priya Planner", admin: false },
  { n: 4, email: "photographer@gather.dev", name: "Pieter Photo", admin: false },
  { n: 5, email: "caterer@gather.dev", name: "Carla Catering", admin: false },
  { n: 6, email: "manager@gather.dev", name: "Mo Manager", admin: false },
  { n: 7, email: "staff@gather.dev", name: "Sam Staff", admin: false },
  { n: 8, email: "florist@gather.dev", name: "Fern Florist", admin: false },
];

// [n, name, category, owner user n, status, id override]
const VENDORS = [
  { n: 1, name: "Dr Dre DJ", cat: "Music/DJ", owner: 1, status: "verified", id: "03abd193-63d9-4ecc-94b6-85b8bb07a1a2" },
  { n: 2, name: "Golden Hour Photography", cat: "Photography", owner: 4, status: "verified" },
  { n: 3, name: "Carla's Kitchen", cat: "Catering", owner: 5, status: "verified" },
  { n: 4, name: "Wildflower Florals", cat: "Florals", owner: 8, status: "verified" },
  { n: 5, name: "Sweet Tooth Cakes", cat: "Cakes & Desserts", owner: 5, status: "verified" },
  { n: 6, name: "Skyline Lighting", cat: "Lighting & AV", owner: 4, status: "verified" },
  { n: 7, name: "Old Mill Venue", cat: "Venue/Rentals", owner: 2, status: "unclaimed" },
  { n: 8, name: "Kasi Kombucha Bar", cat: "Bartending/Beverage Service", owner: 8, status: "claim_pending" },
];

async function createAuthUser(base, key, u) {
  const res = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ id: U(u.n), email: u.email, password: PASSWORD, email_confirm: true }),
  });
  if (res.ok) return "created";
  const body = await res.text();
  // Already there from a previous run (matched by email or id): fine.
  if (res.status === 422 || /already|exists|registered/i.test(body)) return "exists";
  throw new Error(`creating ${u.email} failed: ${res.status} ${body}`);
}

async function seedDemo() {
  const env = loadEnv();
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Demo seed needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  for (const u of USERS) await createAuthUser(base, key, u);
  // Resolve real ids (an account that existed before may have a different id).
  const rows = await sql`select id, email from auth.users where email = any(${USERS.map((u) => u.email)})`;
  const uid = Object.fromEntries(USERS.map((u) => [u.n, rows.find((r) => r.email === u.email)?.id]));
  for (const u of USERS) {
    if (!uid[u.n]) throw new Error(`no auth user for ${u.email}`);
    await sql`
      insert into profiles (id, display_name, is_admin) values (${uid[u.n]}, ${u.name}, ${u.admin})
      on conflict (id) do update set display_name = excluded.display_name, is_admin = excluded.is_admin`;
  }

  for (const v of VENDORS) {
    const vid = v.id ?? V(v.n);
    await sql`
      insert into vendors (id, name, primary_category, description, verification_status, created_by)
      values (${vid}, ${v.name}, ${v.cat}, ${`${v.name} — demo listing for testing.`}, ${v.status}, ${uid[v.owner]})
      on conflict (id) do update set name = excluded.name, primary_category = excluded.primary_category, verification_status = excluded.verification_status`;
    if (v.status !== "unclaimed") {
      await sql`
        insert into vendor_team_members (vendor_id, user_id, role)
        select ${vid}, ${uid[v.owner]}, 'owner'
        where not exists (select 1 from vendor_team_members where vendor_id = ${vid} and user_id = ${uid[v.owner]})`;
    }
    await sql`
      insert into vendor_services (vendor_id, name, description, category_id)
      select ${vid}, ${`${v.cat} package`}, 'Standard demo package', c.id
      from service_categories c
      where c.name = ${v.cat}
        and not exists (select 1 from vendor_services where vendor_id = ${vid})`;
  }
  // A manager and a staff member on Dr Dre DJ's sibling business (Golden Hour) for the permission suites.
  for (const [userN, role] of [[6, "manager"], [7, "staff"]]) {
    await sql`
      insert into vendor_team_members (vendor_id, user_id, role)
      select ${V(2)}, ${uid[userN]}, ${role}::vendor_role
      where not exists (select 1 from vendor_team_members where vendor_id = ${V(2)} and user_id = ${uid[userN]})`;
  }

  // Featured: three live placements (deliberately not Dr Dre DJ, whose suite requests a spot) so the home page and featured suites have data.
  for (const [i, vn] of [[1, 2], [2, 3], [3, 4]]) {
    await sql`
      insert into vendor_feature_placements (vendor_id, status, starts_on, ends_on, position, created_by)
      select ${V(vn)}, 'activated', current_date - 1, current_date + 60, ${i}, ${uid[2]}
      where not exists (
        select 1 from vendor_feature_placements
        where vendor_id = ${V(vn)} and status = 'activated')`;
  }

  // A planner with a couple of events, attendees, tasks and a budget.
  const [wedding] = await sql`select id from event_types where name = 'Birthday Party'`;
  const events = [
    { n: 1, name: "Priya's 30th Birthday", days: 45 },
    { n: 2, name: "Office Year-End Function", days: 90 },
  ];
  for (const ev of events) {
    await sql`
      insert into events (id, owner_id, name, event_type, event_type_id, status, visibility, start_at, location, capacity)
      values (${E(ev.n)}, ${uid[3]}, ${ev.name}, 'Birthday Party', ${wedding?.id ?? null}, 'published', 'private',
              now() + ${`${ev.days} days`}::interval, 'Cape Town', 60)
      on conflict (id) do update set name = excluded.name`;
    await sql`
      insert into event_attendees (event_id, name, email, rsvp_status)
      select ${E(ev.n)}, g.name, g.email, 'no_response'::rsvp_status
      from (values ('Alex Guest', 'alex@example.com'), ('Bee Guest', 'bee@example.com')) as g(name, email)
      where not exists (select 1 from event_attendees where event_id = ${E(ev.n)})`;
    await sql`
      insert into event_tasks (event_id, title, due_date)
      select ${E(ev.n)}, t.title, current_date + t.d
      from (values ('Book the venue', 7), ('Send invitations', 21)) as t(title, d)
      where not exists (select 1 from event_tasks where event_id = ${E(ev.n)})`;
    await sql`
      insert into budget_items (event_id, label, budgeted_amount)
      select ${E(ev.n)}, b.label, b.amt
      from (values ('Venue', 5000), ('Catering', 8000)) as b(label, amt)
      where not exists (select 1 from budget_items where event_id = ${E(ev.n)})`;
  }
  await sql`
    insert into event_vendors (event_id, vendor_id, status)
    select ${E(1)}, ${V(3)}, 'shortlisted'
    where not exists (select 1 from event_vendors where event_id = ${E(1)} and vendor_id = ${V(3)})`;

  console.log(`demo: ${USERS.length} accounts (password ${PASSWORD}), ${VENDORS.length} businesses, ${events.length} events`);
}

try {
  if (mode === "reference" || mode === "all") await seedReference();
  if (mode === "demo" || mode === "all") await seedDemo();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
