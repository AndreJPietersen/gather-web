import { S, BASE, errs, check, finish, sqlConnect, launchBrowser } from "../lib/harness.mjs";
const sql = sqlConnect();
const b = await launchBrowser();
const VENDOR = "03abd193-63d9-4ecc-94b6-85b8bb07a1a2"; // Dr Dre DJ, owned by vendortest@gather.dev

async function login(email, width = 390) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', "GatherTest123!");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 10000 });
  return p;
}

try {
  const v = await login("vendortest@gather.dev");
  await v.goto(`${BASE}/vendor/${VENDOR}/dashboard`, { waitUntil: "networkidle" });
  check("dashboard shows the Request a spot card", (await v.getByText("Request a spot").count()) > 0);
  await v.screenshot({ path: S + "e1-dash.png" });

  await v.goto(BASE + "/vendors", { waitUntil: "networkidle" });
  check("marketplace shows the Your spot here card", (await v.getByText("Your spot here").count()) > 0);
  await v.screenshot({ path: S + "e2-market.png" });

  await v.goto(`${BASE}/vendor/${VENDOR}/featured`, { waitUntil: "networkidle" });
  await v.screenshot({ path: S + "e3-form.png", fullPage: true });
  await v.getByRole("button", { name: "Send request" }).click();
  await v.waitForURL(/sent=1/, { timeout: 10000 });
  check("request-sent confirmation shown", (await v.getByText("Request sent").count()) > 0);

  const [row] = await sql`select id, status, starts_on::text, ends_on::text, requested_spot, requested_duration from vendor_feature_placements where vendor_id = ${VENDOR}`;
  check("a pending 1-month rotating request row is created", row.status === "pending" && row.requested_spot === "rotating" && row.requested_duration === "1_month", JSON.stringify(row));

  await v.goto(`${BASE}/vendor/${VENDOR}/dashboard`, { waitUntil: "networkidle" });
  check("dashboard shows the pending request", (await v.getByText("Featured request").count()) > 0);
  await v.screenshot({ path: S + "e4-pending.png" });

  // admin: see request, set a price, toggle off
  const a = await login("phonetest@gather.dev", 1200);
  await a.goto(BASE + "/admin/featured", { waitUntil: "networkidle" });
  check("admin sees 'Requested by the vendor'", (await a.getByText("Requested by the vendor").count()) > 0);
  await a.screenshot({ path: S + "e5-admin.png", fullPage: true });
  await a.getByRole("button", { name: "Turn off" }).click();
  await a.waitForTimeout(1500);
  check("switching off is stored", (await sql`select featured_enabled from app_settings`)[0].featured_enabled === false);

  const g = await b.newPage({ viewport: { width: 390, height: 900 } });
  await g.goto(BASE + "/vendors", { waitUntil: "networkidle" });
  check("public Featured heading is hidden while off", (await g.getByRole("heading", { name: "Featured" }).count()) === 0);
  await g.goto(BASE + "/featured", { waitUntil: "networkidle" });
  check("pricing page says unavailable while off", (await g.getByText("aren't available yet").count()) > 0);
  await v.goto(`${BASE}/vendor/${VENDOR}/dashboard`, { waitUntil: "networkidle" });
  check("vendor's pending card is hidden while off", (await v.getByText("Featured request").count()) === 0);

  await a.goto(BASE + "/admin/featured", { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Turn on" }).click();
  await a.waitForTimeout(1500);
  await g.goto(BASE + "/vendors", { waitUntil: "networkidle" });
  check("public Featured heading returns when on", (await g.getByRole("heading", { name: "Featured" }).count()) > 0);

  // pricing page in admin
  await a.goto(BASE + "/admin/featured/pricing", { waitUntil: "networkidle" });
  await a.screenshot({ path: S + "e6-pricing.png", fullPage: true });
} finally {
  await sql`delete from vendor_feature_placements where vendor_id = ${VENDOR}`;
  await sql`update app_settings set featured_enabled = true`;
  check("test data cleaned up and the switch left on", (await sql`select featured_enabled from app_settings`)[0].featured_enabled === true && (await sql`select count(*)::int n from vendor_feature_placements where vendor_id = ${VENDOR} and status = 'pending'`)[0].n === 0);
  await sql.end();
  await b.close();
}

finish();
