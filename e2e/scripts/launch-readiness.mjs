// L3 launch-readiness: legal pages, 404, robots/sitemap, the password-reset
// flow end to end (through the real email in Mailpit), the bad-link guard,
// and deleting an account from the Profile page.
import { BASE, MAILPIT, TEST_PASSWORD, check, finish, crash, sqlConnect, serviceClient, anonClient, launchBrowser, login } from "../lib/harness.mjs";

const sql = sqlConnect();
const admin = serviceClient();
const made = [];
const mkUser = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (error) throw error;
  made.push(data.user.id);
  return data.user.id;
};
const text = async (path) => {
  const r = await fetch(BASE + path, { redirect: "manual" });
  return { status: r.status, body: await r.text() };
};

const browser = await launchBrowser();
try {
  // --- public pages
  const priv = await text("/privacy");
  check("privacy policy is public and names the information officer", priv.status === 200 && priv.body.includes("information officer"));
  const terms = await text("/terms");
  check("terms of use are public", terms.status === 200 && terms.body.includes("Acceptable use"));
  const reg = await text("/register");
  check("register page links the terms and privacy policy", reg.body.includes("/terms") && reg.body.includes("/privacy"));
  const lg = await text("/login");
  check("login page links 'Forgot your password?'", lg.body.includes("/forgot-password"));
  const nf = await text("/this-page-does-not-exist");
  check("unknown URL gives a friendly 404", nf.status === 404 && nf.body.includes("find that page"));
  const robots = await text("/robots.txt");
  check("robots.txt hides admin and points at the sitemap", robots.body.includes("Disallow: /admin") && robots.body.includes("sitemap.xml"));
  const map = await text("/sitemap.xml");
  check("sitemap lists public pages and verified vendors", map.body.includes("/vendors") && /\/vendors\/[0-9a-f-]{36}/.test(map.body));
  const unverified = await sql`select id from vendors where verification_status <> 'verified' or hidden_at is not null`;
  check("sitemap never lists unverified or hidden businesses", unverified.every((v) => !map.body.includes(v.id)));

  // --- bad email links go nowhere dangerous
  const bad = await fetch(BASE + "/auth/confirm?token_hash=nope&type=recovery&next=//evil.example", { redirect: "manual" });
  const loc = bad.headers.get("location") ?? "";
  check("a bad email link lands on login with a message, never an outside site", loc.includes("/login?link=invalid") && !loc.includes("evil"), loc);

  // --- password reset, end to end
  const resetEmail = "zzreset@gather.dev";
  await mkUser(resetEmail);
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/forgot-password", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "nobody-here@gather.dev");
  await page.click('button[type="submit"]');
  const genericShown = await page.getByText("Check your email").waitFor({ timeout: 30000 }).then(() => true, () => false);
  check("unknown address gets the same 'check your email' answer (no account lookup)", genericShown);
  await page.goto(BASE + "/forgot-password", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', resetEmail);
  await page.click('button[type="submit"]');
  await page.getByText("Check your email").waitFor({ timeout: 30000 });
  let link = null;
  let brandedMail = false;
  for (let i = 0; i < 20 && !link; i++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=50`)).json()).messages ?? [];
    const m = list.find((x) => x.To?.some((t) => t.Address === resetEmail));
    if (m) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
      brandedMail = full.HTML.includes("Reset your password") && full.HTML.includes("Choose a new password") && full.HTML.includes("icon-512.png");
      link = (full.Text + " " + full.HTML).match(/https?:\/\/[^\s"<>]*auth\/confirm[^\s"<>]*/)?.[0]?.replace(/&amp;/g, "&") ?? null;
    }
    if (!link) await new Promise((r) => setTimeout(r, 500));
  }
  check("the reset email arrives with a link", !!link);
  check("the reset email uses the Gather layout", brandedMail);
  if (link) {
    await page.goto(link, { waitUntil: "networkidle" });
    check("the link lands on the choose-new-password page", page.url().includes("/reset-password"), page.url());
    await page.fill('input[name="password"]', "BrandNew456!");
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.includes("/reset-password"), { timeout: 15000 });
    const { error } = await anonClient().auth.signInWithPassword({ email: resetEmail, password: "BrandNew456!" });
    check("the new password works", !error, error?.message ?? "");
    const { error: old } = await anonClient().auth.signInWithPassword({ email: resetEmail, password: TEST_PASSWORD });
    check("the old password no longer works", !!old);
  }
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(BASE + "/reset-password", { waitUntil: "networkidle" });
  check("reset page without a link says it has expired", await anon.getByText("expired or was already used").isVisible());

  // --- delete my account, from the Profile page
  const delEmail = "zzuidelete@gather.dev";
  const delId = await mkUser(delEmail);
  await sql`insert into events (name, owner_id, start_at, status, visibility) values ('ZZL event', ${delId}, now() + interval '5 days', 'published', 'private')`;
  const p = await login(browser, delEmail);
  await p.goto(BASE + "/profile", { waitUntil: "networkidle" });
  await p.getByText("Delete my account", { exact: true }).click();
  await p.fill('input[name="confirm"]', "delete");
  await p.getByRole("button", { name: "Permanently delete my account" }).click();
  check("wrong confirmation text is refused", await p.getByText("Type DELETE").waitFor({ timeout: 30000 }).then(() => true, () => false));
  await p.fill('input[name="confirm"]', "DELETE");
  await p.getByRole("button", { name: "Permanently delete my account" }).click();
  await p.waitForURL((u) => u.searchParams.get("deleted") === "1", { timeout: 20000 });
  const [{ n: userLeft }] = await sql`select count(*)::int n from auth.users where id = ${delId}`;
  const [{ n: evLeft }] = await sql`select count(*)::int n from events where name = 'ZZL event'`;
  check("account and its events are gone after confirming", userLeft === 0 && evLeft === 0);
  const { error: relog } = await anonClient().auth.signInWithPassword({ email: delEmail, password: TEST_PASSWORD });
  check("the deleted account can no longer sign in", !!relog);
} catch (e) {
  crash(e);
} finally {
  await browser.close();
  await sql`delete from events where name like 'ZZL%'`.catch(() => {});
  for (const id of made) await admin.auth.admin.deleteUser(id).catch(() => {});
  await sql.end();
}
finish();
