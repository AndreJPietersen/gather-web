import { S, env, BASE, errs, check, finish, sqlConnect, launchBrowser } from "../lib/harness.mjs";
import { createClient } from "@supabase/supabase-js";
const sql = sqlConnect();
const b = await launchBrowser();
const [{ id: UID }] = await sql`select id from auth.users where email = 'vendortest@gather.dev'`;

async function login(email, width = 390) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', "GatherTest123!");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await p.waitForLoadState("networkidle");
  return p;
}
async function create(p, name, category) {
  await p.goto(BASE + "/onboarding/vendor", { waitUntil: "networkidle" });
  await p.fill('input[name="name"]', name);
  await p.selectOption('select[name="primaryCategory"]', category);
  await p.getByRole("button", { name: "Create business" }).click();
  await p.waitForTimeout(2500);
}

try {
  // 1. RLS bypass is closed: a user can no longer make themselves owner via the API.
  const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await api.auth.signInWithPassword({ email: "vendortest@gather.dev", password: "GatherTest123!" });
  const { data: stub } = await api.from("vendors").insert({ name: "ZZTest API stub", created_by: UID }).select("id").single();
  const { error: bypass } = await api.from("vendor_team_members").insert({ vendor_id: stub.id, user_id: UID, role: "owner" });
  check("making yourself an owner directly through the API is blocked", !!bypass, bypass?.code);

  // 2. Login with 2 personas lands on the picker.
  const v = await login("vendortest@gather.dev");
  check("login with two personas lands on the picker", new URL(v.url()).pathname === "/choose-persona" && (await v.getByRole("heading", { name: "Who are you today?" }).count()) > 0);
  await v.screenshot({ path: S + "b1-picker.png" });
  await v.getByText("Dr Dre DJ").click();
  await v.waitForURL(/\/vendor\/.+\/dashboard/, { timeout: 10000 });
  check("choosing a vendor opens its dashboard", /\/vendor\/.+\/dashboard/.test(new URL(v.url()).pathname));

  // 3. Profile shows Add a business.
  await v.goto(BASE + "/profile", { waitUntil: "networkidle" });
  check("profile shows + Add a business", (await v.getByText("+ Add a business").count()) > 0);
  await v.screenshot({ path: S + "b2-profile.png", fullPage: true });

  // 4. Second business in a new category: allowed.
  await create(v, "ZZTest Snaps", "Photography");
  check("a second business in a new category is created", /\/vendor\/.+\/dashboard/.test(new URL(v.url()).pathname));

  // 5. Same category again: blocked, then request.
  await create(v, "ZZTest Snaps Two", "Photography");
  check("a duplicate category is blocked with an approval prompt", (await v.getByText("This one needs approval").count()) > 0);
  await v.screenshot({ path: S + "b3-blocked.png", fullPage: true });
  await v.fill('textarea[name="reason"]', "A separate wedding-only studio brand with its own team.");
  await v.getByRole("button", { name: "Request approval" }).click();
  await v.waitForURL(/requested=1/, { timeout: 10000 });
  check("the exception request is sent", (await v.getByText("Request sent").count()) > 0);
  const [req] = await sql`select id, status, needs_extra_slot, needs_duplicate_category from vendor_business_requests where requester_id = ${UID}`;
  check("the request records a duplicate-category exception", req.status === "pending" && req.needs_duplicate_category === true && req.needs_extra_slot === false, JSON.stringify(req));

  // 6. Admin approves.
  const a = await login("phonetest@gather.dev", 1300);
  check("a single-persona admin lands on Home", new URL(a.url()).pathname === "/");
  await a.goto(BASE + "/admin/vendors/requests", { waitUntil: "networkidle" });
  await a.screenshot({ path: S + "b4-admin.png", fullPage: true });
  await a.getByRole("button", { name: "Approve" }).click();
  await a.waitForTimeout(1500);
  check("admin approval is recorded", (await sql`select status from vendor_business_requests where id = ${req.id}`)[0].status === "approved");

  // 7. Now the duplicate goes through and spends the approval.
  await create(v, "ZZTest Snaps Two", "Photography");
  check("the approved duplicate can now be created", /\/vendor\/.+\/dashboard/.test(new URL(v.url()).pathname));
  const spent = (await sql`select status, used_vendor_id is not null as linked from vendor_business_requests where id = ${req.id}`)[0];
  check("the approval is spent (used, linked to the new business)", spent.status === "used" && spent.linked === true, JSON.stringify(spent));

  // 8. Fill to the limit (5) directly, then try a 6th.
  for (const [n, c] of [["ZZTest Cakes", "Cakes & Desserts"], ["ZZTest Blooms", "Florals"]]) {
    const [row] = await sql`insert into vendors (name, primary_category, created_by) values (${n}, ${c}, ${UID}) returning id`;
    await sql`insert into vendor_team_members (vendor_id, user_id, role) values (${row.id}, ${UID}, 'owner')`;
  }
  await create(v, "ZZTest Sixth", "Catering");
  const blockedText = await v.locator("text=This one needs approval").locator("..").innerText().catch(() => "");
  check("a sixth business is blocked by the 5-business limit", blockedText.includes("limit is 5"));

  // 9. Edit: changing a business to a category the owner already has is refused.
  const [snaps] = await sql`select id from vendors where name = 'ZZTest Cakes'`;
  await v.goto(`${BASE}/vendor/${snaps.id}/edit`, { waitUntil: "networkidle" });
  await v.selectOption('select[name="primaryCategory"]', "Florals");
  await v.getByRole("button", { name: "Save Changes" }).click();
  await v.waitForTimeout(2000);
  check("re-categorising into a clashing category is refused", (await v.getByText("one business per category").count()) > 0);
} finally {
  await sql`delete from vendor_business_requests where requester_id = ${UID}`;
  await sql`delete from vendors where name like 'ZZTest%'`;
  check("test data cleaned up", (await sql`select count(*)::int n from vendors where name like 'ZZTest%'`)[0].n === 0);
  await sql.end();
  await b.close();
}

finish();
