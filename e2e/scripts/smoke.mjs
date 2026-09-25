import { S, BASE, errs, check, finish, sqlConnect, launchBrowser } from "../lib/harness.mjs";
const sql = sqlConnect();
const b = await launchBrowser();
const DRE = "03abd193-63d9-4ecc-94b6-85b8bb07a1a2";

async function login(email, width = 390) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${email}: ${e.message}`));
  p.on("response", (r) => { if (r.status() >= 500) errs.push(`${r.status()} ${r.url()}`); });
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', "GatherTest123!");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"));
  return p;
}
const bad = async (p) => (await p.getByText(/Something went wrong|permission denied|Application error/i).count());

try {
  const v = await login("vendortest@gather.dev");
  // Planner: create an event through the real form.
  await v.goto(BASE + "/events/new", { waitUntil: "networkidle" });
  await v.fill('input[name="name"]', "ZZSmoke party");
  const typeSelect = v.locator('select[name="eventTypeId"], select[name="eventType"]').first();
  if (await typeSelect.count()) await typeSelect.selectOption({ index: 1 });
  await v.fill('input[name="startAt"]', "2026-12-12T18:00");
  await v.getByRole("button", { name: /create|save/i }).first().click();
  await v.waitForURL(/\/events\/[0-9a-f-]{36}/, { timeout: 15000 });
  const eventId = v.url().match(/events\/([0-9a-f-]{36})/)[1];
  check("an event is created through the UI", !!eventId && (await bad(v)) === 0);

  for (const path of ["", "/edit", "/attendees", "/tasks", "/budget", "/vendors", "/payments", "/mood-board", "/gallery"]) {
    const r = await v.goto(`${BASE}/events/${eventId}${path}`, { waitUntil: "networkidle" });
    check(`event page ${path || "home"} loads`, r.status() === 200 && (await bad(v)) === 0, String(r.status()));
  }
  // Edit event (events column grants).
  await v.goto(`${BASE}/events/${eventId}/edit`, { waitUntil: "networkidle" });
  await v.fill('input[name="name"]', "ZZSmoke party edited");
  await v.getByRole("button", { name: /save/i }).first().click();
  await v.waitForTimeout(2500);
  // Inline edit forms must close themselves after a successful save (the
  // attendee and budget rows close via "adjust state during render").
  await sql`insert into event_attendees (event_id, name) values (${eventId}, 'ZZSmoke guest')`;
  await v.goto(`${BASE}/events/${eventId}/attendees`, { waitUntil: "networkidle" });
  await v.getByRole("button", { name: "Edit ZZSmoke guest" }).click();
  await v.locator('input[name="name"]').fill("ZZSmoke guest renamed");
  await v.getByRole("button", { name: "Save" }).click();
  await v.getByText("ZZSmoke guest renamed").waitFor({ timeout: 10000 });
  check("attendee edit saves and the form closes", (await v.locator('input[name="name"]').count()) === 0);
  await sql`insert into budget_items (event_id, label, budgeted_amount) values (${eventId}, 'ZZSmoke line', 1000)`;
  await v.goto(`${BASE}/events/${eventId}/budget`, { waitUntil: "networkidle" });
  await v.getByRole("button", { name: "Edit", exact: true }).first().click();
  await v.locator('input[name="label"]').fill("ZZSmoke line renamed");
  await v.getByRole("button", { name: "Save" }).click();
  await v.getByText("ZZSmoke line renamed").waitFor({ timeout: 10000 });
  check("budget item edit saves and the form closes", (await v.locator('input[name="label"]').count()) === 0);
  check("an event edit is saved",(await sql`select name from events where id = ${eventId}`)[0].name === "ZZSmoke party edited");

  // Profile edit (reads own phone server-side, writes display_name/phone).
  await v.goto(BASE + "/profile/edit", { waitUntil: "networkidle" });
  const phoneBefore = await v.inputValue('input[name="phone"]');
  await v.fill('input[name="phone"]', "0821234567");
  await v.getByRole("button", { name: /save/i }).first().click();
  await v.waitForTimeout(2500);
  const [prof] = await sql`select phone from profiles where id = (select id from auth.users where email = 'vendortest@gather.dev')`;
  check("the profile phone number is saved", prof.phone === "0821234567", `was ${JSON.stringify(phoneBefore)}`);
  await sql`update profiles set phone = ${phoneBefore || null} where id = (select id from auth.users where email = 'vendortest@gather.dev')`;

  // Vendor side pages.
  for (const path of ["dashboard", "dashboard/bookings", "edit", "team", "featured", "dashboard/reviews", "dashboard/services"]) {
    const r = await v.goto(`${BASE}/vendor/${DRE}/${path}`, { waitUntil: "networkidle" });
    check(`vendor page ${path} loads`, r.status() === 200 && (await bad(v)) === 0, String(r.status()));
  }
  for (const path of ["/", "/vendors", `/vendors/${DRE}`, "/profile", "/faq", "/featured"]) {
    const r = await v.goto(BASE + path, { waitUntil: "networkidle" });
    check(`public page ${path} loads`, r.status() === 200 && (await bad(v)) === 0, String(r.status()));
  }

  // Admin settings forms.
  const a = await login("phonetest@gather.dev", 1300);
  await a.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
  await a.screenshot({ path: S + "s1-settings.png", fullPage: true });
  await a.fill('input[name="max_owned_businesses"]', "6");
  await a.locator("form", { has: a.locator('input[name="max_owned_businesses"]') }).getByRole("button", { name: "Save" }).click();
  await a.waitForTimeout(1500);
  await a.fill('input[name="watch_listing_min"]', "4");
  await a.locator("form", { has: a.locator('input[name="watch_listing_min"]') }).getByRole("button", { name: "Save" }).click();
  await a.waitForTimeout(1500);
  await a.fill('input[name="limit__events"]', "25");
  await a.locator("form", { has: a.locator('input[name="limit__events"]') }).getByRole("button", { name: "Save" }).click();
  await a.waitForTimeout(1500);
  const [st] = await sql`select max_owned_businesses, watch_listing_min from app_settings`;
  const [rl] = await sql`select max_per_hour from write_rate_limits where table_name = 'events'`;
  check("each Settings form saves to the database", st.max_owned_businesses === 6 && st.watch_listing_min === 4 && rl.max_per_hour === 25, `${st.max_owned_businesses}, ${st.watch_listing_min}, ${rl.max_per_hour}`);
  await v.goto(BASE + "/profile", { waitUntil: "networkidle" });
  check("Profile reflects the new business limit", (await v.getByText(/of 6/).count()) > 0);
  await a.goto(BASE + "/admin/watchlist", { waitUntil: "networkidle" });
  // (The threshold explanations only render for flagged entries, so check
  // the always-present pointer to Settings instead.)
  check("the watchlist page points to the thresholds in Settings", (await a.getByText("Thresholds are set on the").count()) > 0);
  for (const path of ["/admin", "/admin/vendors", `/admin/vendors/${DRE}`, "/admin/vendors/requests", "/admin/featured", "/admin/planners"]) {
    const r = await a.goto(BASE + path, { waitUntil: "networkidle" });
    check(`admin page ${path} loads`, r.status() === 200 && (await bad(a)) === 0, String(r.status()));
  }
} finally {
  await sql`update app_settings set max_owned_businesses = 5, watch_listing_min = 5`;
  await sql`update write_rate_limits set max_per_hour = 20 where table_name = 'events'`;
  await sql`delete from events where name like 'ZZSmoke%'`;
  await sql`delete from user_write_log`;
  await sql.end();
  await b.close();
}

finish();
