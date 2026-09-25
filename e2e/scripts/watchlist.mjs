import { S, env, BASE, errs, check, finish, sqlConnect, launchBrowser } from "../lib/harness.mjs";
import { createClient } from "@supabase/supabase-js";
const sql = sqlConnect();
const b = await launchBrowser();
const [{ id: UID }] = await sql`select id from auth.users where email = 'vendortest@gather.dev'`;
const [{ id: ADMIN }] = await sql`select id from auth.users where email = 'phonetest@gather.dev'`;
const DRE = "03abd193-63d9-4ecc-94b6-85b8bb07a1a2";
try {
  const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await api.auth.signInWithPassword({ email: "vendortest@gather.dev", password: "GatherTest123!" });

  // Closed holes: owner can't plant a stranger, directly or by re-pointing a row.
  const { error: e1 } = await api.from("vendor_team_members").insert({ vendor_id: DRE, user_id: ADMIN, role: "owner" });
  check("an owner can't add anyone directly to their team", e1?.code === "42501", e1?.code);
  const [own] = await sql`select id from vendor_team_members where vendor_id = ${DRE} and user_id = ${UID}`;
  const { error: e2 } = await api.from("vendor_team_members").update({ user_id: ADMIN }).eq("id", own.id);
  const [after] = await sql`select user_id from vendor_team_members where id = ${own.id}`;
  check("re-pointing a membership row is refused and leaves it unchanged", e2?.code === "42501" && after.user_id === UID, e2?.code);
  const { error: e3 } = await api.from("vendor_team_members").update({ is_active: true }).eq("id", own.id);
  check("updating the allowed columns still works", !e3);
  const { error: e4 } = await api.rpc("admin_watchlist", { p_listing_days: 7, p_listing_min: 1, p_team_min: 1, p_claim_days: 30, p_claim_min: 1, p_invite_days: 7, p_invite_min: 1, p_contact_min: 1 });
  check("the watchlist function isn't callable by users", e4?.code === "42501", e4?.code);

  // Simulate a flood: 6 stubs with the same phone and website, via the API like an abuser would.
  for (let i = 1; i <= 6; i++) {
    await api.from("vendors").insert({ name: `ZZFlood Photo ${i}`, primary_category: "Photography", phone: "082 555 0199", website: i % 2 ? "https://www.zzflood.example/" : "zzflood.example", created_by: UID });
  }

  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
  const a = await ctx.newPage();
  a.on("pageerror", (e) => errs.push(e.message));
  await a.goto(BASE + "/login", { waitUntil: "networkidle" });
  await a.fill('input[name="email"]', "phonetest@gather.dev");
  await a.fill('input[name="password"]', "GatherTest123!");
  await a.click('button[type="submit"]');
  await a.waitForURL((u) => !u.pathname.includes("/login"));
  await a.goto(BASE + "/admin", { waitUntil: "networkidle" });
  check("the admin dashboard shows the watchlist banner", (await a.getByText(/on the watchlist/).count()) > 0);
  await a.screenshot({ path: S + "w1-dash.png" });
  await a.goto(BASE + "/admin/watchlist", { waitUntil: "networkidle" });
  for (const t of ["Lots of new listings", "Listings sharing contact details"]) check(`watchlist section: ${t}`, (await a.getByRole("heading", { name: new RegExp(t) }).count()) > 0);
  check("look-alikes sharing a phone and a website are grouped", (await a.getByText("Phone 0825550199").count()) > 0 && (await a.getByText("Website zzflood.example").count()) > 0);
  await a.screenshot({ path: S + "w2-watch.png", fullPage: true });
} finally {
  await sql`delete from vendors where name like 'ZZFlood%'`;
  await sql`update vendor_team_members set is_active = true where vendor_id = ${DRE} and user_id = ${UID}`;
  check("test data cleaned up", (await sql`select count(*)::int n from vendors where name like 'ZZFlood%'`)[0].n === 0);
  await sql.end();
  await b.close();
}

finish();
