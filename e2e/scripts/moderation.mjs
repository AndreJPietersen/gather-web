import { S, env, BASE, errs, check, finish, sqlConnect, launchBrowser } from "../lib/harness.mjs";
import { createClient } from "@supabase/supabase-js";
const sql = sqlConnect();
const b = await launchBrowser();
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SPAM = "zzspam@gather.dev", PW = "GatherTest123!";
let spamId;
const newApi = () => createClient(URL_, ANON, { auth: { persistSession: false } });

async function adminPage() {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "phonetest@gather.dev");
  await p.fill('input[name="password"]', PW);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"));
  return p;
}

try {
  const { data: created } = await admin.auth.admin.createUser({ email: SPAM, password: PW, email_confirm: true });
  spamId = created.user.id;
  await sql`update profiles set display_name = 'ZZ Spammer' where id = ${spamId}`;
  const spam = newApi();
  await spam.auth.signInWithPassword({ email: SPAM, password: PW });

  // 1. Daily cap enforced in the DB, even straight at the API.
  await sql`update app_settings set listing_daily_limit = 6`;
  const results = [];
  for (let i = 1; i <= 7; i++) {
    const { error } = await spam.from("vendors").insert({ name: `ZZSpam Snaps ${i}`, primary_category: "Photography", phone: "083 111 2222", created_by: spamId });
    results.push(error ? "blocked" : "ok");
  }
  check("the daily cap is enforced at the API (6 succeed, the 7th is refused)", results.join(",") === "ok,ok,ok,ok,ok,ok,blocked", results.join(","));
  await sql`update app_settings set listing_daily_limit = 10`;

  // 2. Watchlist shows it; dismiss the shared-phone entry.
  const a = await adminPage();
  await a.goto(BASE + "/admin/watchlist", { waitUntil: "networkidle" });
  const phoneCard = a.locator("div.rounded-\\[22px\\]", { hasText: "Phone 0831112222" }).first();
  await phoneCard.locator('input[name="note"]').fill("Test: one studio, fine");
  await phoneCard.getByRole("button", { name: "Dismiss" }).click();
  await a.waitForTimeout(1500);
  check("dismissing an entry moves it to the Dismissed list", (await a.getByText(/Dismissed \(\d+\)/).count()) > 0);
  await a.screenshot({ path: S + "m1-watch.png", fullPage: true });

  // 3. It comes back once it grows.
  await sql`insert into vendors (name, phone, created_by) values ('ZZSpam Snaps extra', '0831112222', ${spamId})`;
  await a.reload({ waitUntil: "networkidle" });
  check("a dismissed entry that grows comes back", (await a.locator("div.rounded-\\[22px\\]", { hasText: "Phone 0831112222" }).count()) > 0);

  // 4. One-click hide from the burst entry.
  const burst = a.locator("div.rounded-\\[22px\\]", { hasText: "ZZ Spammer" }).first();
  await burst.getByRole("button", { name: /Hide these/ }).click();
  await a.waitForTimeout(1500);
  const [{ n: hidden }] = await sql`select count(*)::int n from vendors where created_by = ${spamId} and hidden_at is not null`;
  const { data: pub } = await newApi().from("vendors").select("id").like("name", "ZZSpam%");
  const { data: own } = await spam.from("vendors").select("id").like("name", "ZZSpam%");
  check("hiding removes listings from the public but not the creator", hidden > 0 && pub.length === 0 && own.length === hidden, `hidden ${hidden}, public ${pub.length}, creator ${own.length}`);

  // 5. Restore one from its vendor page.
  const [one] = await sql`select id from vendors where name = 'ZZSpam Snaps 1'`;
  await a.goto(`${BASE}/admin/vendors/${one.id}`, { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Restore listing" }).click();
  await a.waitForTimeout(1500);
  check("restoring a listing makes it visible again", (await sql`select hidden_at is null as visible from vendors where id = ${one.id}`)[0].visible === true);

  // 6. Suspend from the user page, hiding their listings.
  await a.goto(`${BASE}/admin/planners/${spamId}`, { waitUntil: "networkidle" });
  await a.fill('input[name="reason"]', "Test suspension");
  await a.getByRole("button", { name: "Suspend account" }).click();
  await a.waitForSelector("text=Lift suspension", { timeout: 10000 });
  await a.screenshot({ path: S + "m2-user.png", fullPage: true });
  check("suspending records it and re-hides their listings", (await sql`select count(*)::int n from user_suspensions where user_id = ${spamId}`)[0].n === 1 && (await sql`select hidden_at is not null as h from vendors where id = ${one.id}`)[0].h === true);
  const { error: loginErr } = await newApi().auth.signInWithPassword({ email: SPAM, password: PW });
  check("a suspended user can't sign in (user_banned)", loginErr?.code === "user_banned", loginErr?.code);
  const { error: getUserErr } = await spam.auth.getUser();
  const { error: writeErr } = await spam.from("vendors").insert({ name: "ZZSpam after ban", created_by: spamId });
  check("a suspended user's existing session can't write", !!writeErr, getUserErr ? (getUserErr.code ?? getUserErr.message) : "session still valid");

  const g = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  await g.goto(BASE + "/login", { waitUntil: "networkidle" });
  await g.fill('input[name="email"]', SPAM);
  await g.fill('input[name="password"]', PW);
  await g.click('button[type="submit"]');
  await g.waitForTimeout(2000);
  check("the login page explains the suspension", (await g.getByText("This account has been suspended").count()) > 0);

  await a.getByRole("button", { name: "Lift suspension" }).click();
  await a.waitForTimeout(1500);
  const { error: back } = await newApi().auth.signInWithPassword({ email: SPAM, password: PW });
  check("lifting the suspension lets them sign in again", !back);

  // 11. Registration kill switch.
  await a.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Pause sign-ups" }).click();
  await a.waitForSelector("text=Sign-ups are paused");
  await a.screenshot({ path: S + "m3-settings.png", fullPage: true });
  await g.goto(BASE + "/register", { waitUntil: "networkidle" });
  check("the register page shows paused with no form", (await g.getByText("Sign-ups are paused").count()) > 0 && (await g.locator('input[name="email"]').count()) === 0);
  const { error: directSignup } = await newApi().auth.signUp({ email: "zzdirect@gather.dev", password: PW });
  check("a direct API sign-up is refused while paused", !!directSignup, directSignup?.message);
  await a.getByRole("button", { name: "Open sign-ups" }).click();
  await a.waitForSelector("text=Sign-ups are open");
  const { error: openSignup } = await newApi().auth.signUp({ email: "zzdirect@gather.dev", password: PW });
  check("sign-up works again after reopening", !openSignup, openSignup?.message);
} finally {
  await sql`update app_settings set registration_enabled = true, listing_daily_limit = 10`;
  await sql`delete from admin_watchlist_dismissals where subject_key like '%0831112222%' or subject_key = ${spamId ?? ""}`;
  if (spamId) {
    await sql`delete from vendors where created_by = ${spamId}`;
    await sql`delete from user_suspensions where user_id = ${spamId}`;
    await admin.auth.admin.deleteUser(spamId).catch(() => {});
  }
  const [d] = await sql`select id from auth.users where email = 'zzdirect@gather.dev'`;
  if (d) await admin.auth.admin.deleteUser(d.id);
  const left = (await sql`select registration_enabled, listing_daily_limit, (select count(*)::int from vendors where name like 'ZZSpam%') left_over, (select count(*)::int from auth.users where email like 'zz%@gather.dev') users from app_settings`)[0];
  check("test data cleaned up and settings restored", left.registration_enabled === true && left.listing_daily_limit === 10 && left.left_over === 0 && left.users === 0, JSON.stringify(left));
  await sql.end();
  await b.close();
}

finish();
