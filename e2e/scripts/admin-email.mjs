import { S, env, BASE, MAILPIT as MP, errs, check, finish, sqlConnect, launchBrowser } from "../lib/harness.mjs";
import { createClient } from "@supabase/supabase-js";
const sql = sqlConnect();
const b = await launchBrowser();
const DRE = "03abd193-63d9-4ecc-94b6-85b8bb07a1a2";
const mailpit = async () => (await (await fetch(`${MP}/api/v1/messages?limit=200`)).json()).messages ?? [];
const clearMail = () => fetch(`${MP}/api/v1/messages`, { method: "DELETE" });
const waitMail = async (pred, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const m = (await mailpit()).filter(pred);
    if (m.length) return m;
    await new Promise((r) => setTimeout(r, 400));
  }
  return [];
};
const to = (m) => (m.To ?? []).map((t) => t.Address.toLowerCase());
const createdTemplates = [];
const startedAt = new Date();

async function login(email, width = 1400) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.5 });
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

try {
  await clearMail();
  const a = await login("phonetest@gather.dev");

  // 1. Templates list
  await a.goto(BASE + "/admin/emails", { waitUntil: "networkidle" });
  check("templates list shows the 4 automatic templates", (await a.getByText("Automatic", { exact: true }).count()) === 4);
  await a.screenshot({ path: S + "em1-list.png", fullPage: true });

  // 2. Duplicate "Welcome to Gather", edit the copy, live preview updates
  await a.getByText("Welcome to Gather", { exact: true }).click();
  await a.waitForURL(/templates\/[0-9a-f-]{36}/);
  await a.getByRole("button", { name: "Duplicate" }).click();
  await a.waitForURL(/templates\/[0-9a-f-]{36}/);
  await a.waitForLoadState("networkidle");
  const copyId = a.url().match(/templates\/([0-9a-f-]{36})/)[1];
  createdTemplates.push(copyId);
  await a.locator('label:has-text("Heading") input').fill("Welcome aboard, {{first_name}}!");
  await a.waitForTimeout(300);
  const srcdoc = await a.locator('iframe[title="Email preview"]').getAttribute("srcdoc");
  check("live preview updates with sample values", srcdoc.includes("Welcome aboard, Thandi!"));
  await a.getByRole("button", { name: "Save template" }).click();
  await a.waitForTimeout(1500);
  check("template saved", (await sql`select heading from email_templates where id = ${copyId}`)[0].heading === "Welcome aboard, {{first_name}}!");
  await a.screenshot({ path: S + "em2-editor.png", fullPage: true });

  // 3. HTML mode + test send
  await a.getByRole("button", { name: "HTML", exact: true }).click();
  await a.locator("textarea.font-mono").fill('<h1 style="margin:0 0 12px;">Raw {{first_name}}</h1><p>Custom HTML body.</p><script>alert(1)</script>');
  await a.waitForTimeout(300);
  const srcRaw = await a.locator('iframe[title="Email preview"]').getAttribute("srcdoc");
  check("raw HTML preview renders and strips scripts", srcRaw.includes("Raw Thandi") && !srcRaw.includes("<script>alert"));
  await a.getByRole("button", { name: "Send test to me" }).click();
  const test = await waitMail((m) => m.Subject.startsWith("[Test]") && to(m).includes("phonetest@gather.dev"));
  check("test email arrives in the inbox", test.length === 1, test[0]?.Subject);
  await a.getByRole("button", { name: "Blocks", exact: true }).click();

  // 4. New template
  await a.goto(BASE + "/admin/emails/templates/new", { waitUntil: "networkidle" });
  await a.locator('input[name="name"]').fill("ZZ Test template");
  await a.getByRole("textbox", { name: "Subject", exact: true }).fill("Hello {{first_name}} from the test");
  await a.getByRole("button", { name: "Save template" }).click();
  await a.waitForURL(/templates\/[0-9a-f-]{36}/, { timeout: 10000 });
  createdTemplates.push(a.url().match(/templates\/([0-9a-f-]{36})/)[1]);
  check("new template created", (await sql`select count(*)::int n from email_templates where name = 'ZZ Test template'`)[0].n === 1);

  // 5. Send to one person (vendortest) from the planner page's entry point
  const [{ id: VT }] = await sql`select id from auth.users where email = 'vendortest@gather.dev'`;
  await a.goto(`${BASE}/admin/emails/send?userId=${VT}&templateId=${copyId}`, { waitUntil: "networkidle" });
  await a.screenshot({ path: S + "em3-send.png", fullPage: true });
  await a.getByRole("button", { name: "Check recipients" }).click();
  await a.waitForSelector("text=1 person");
  await a.getByRole("button", { name: "Send email" }).click();
  await a.waitForURL(/emails\/sent\//, { timeout: 15000 });
  const toVt = await waitMail((m) => to(m).includes("vendortest@gather.dev") && m.Subject.includes("Welcome"));
  check("one-person send delivered and personalised", toVt.length === 1, toVt[0]?.Subject);
  await a.screenshot({ path: S + "em4-sent.png", fullPage: true });

  // 6. Group: a business's team
  await a.goto(`${BASE}/admin/emails/send?vendorId=${DRE}`, { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "Check recipients" }).click();
  await a.waitForSelector("text=/\\d+ (person|people)/");
  check("vendor-team segment resolves", (await a.getByText(/1 person/).count()) === 1);

  // 7. Typed addresses, needs SEND confirmation
  await a.goto(`${BASE}/admin/emails/send`, { waitUntil: "networkidle" });
  await a.locator("select").filter({ hasText: "Blank email" }).selectOption({ label: "Invite a vendor to join" });
  await a.getByRole("button", { name: "Email addresses" }).click();
  await a.locator('textarea[name="addresses"]').fill("zz1@example.com, zz2@example.com");
  await a.getByRole("button", { name: "Send email" }).click();
  await a.waitForSelector("text=type SEND to confirm");
  check("multi-recipient send requires typing SEND", true);
  await a.locator('input[name="confirm"]').fill("SEND");
  await a.getByRole("button", { name: "Send email" }).click();
  await a.waitForURL(/emails\/sent\//, { timeout: 15000 });
  const typed = await waitMail((m) => to(m).some((x) => x.startsWith("zz1@") || x.startsWith("zz2@")));
  check("typed addresses both delivered", typed.length === 2, `${typed.length}`);

  // 8. Announcement to typed addresses with one suppressed
  await clearMail();
  await sql`insert into email_suppressions (email) values ('zz2@example.com') on conflict do nothing`;
  await a.goto(`${BASE}/admin/emails/send`, { waitUntil: "networkidle" });
  await a.locator("select").filter({ hasText: "Blank email" }).selectOption({ label: "General announcement" });
  await a.getByRole("button", { name: "Email addresses" }).click();
  await a.locator('textarea[name="addresses"]').fill("zz1@example.com zz2@example.com");
  await a.locator('input[name="confirm"]').fill("SEND");
  await a.getByRole("button", { name: "Send email" }).click();
  await a.waitForURL(/emails\/sent\//, { timeout: 15000 });
  await a.waitForLoadState("networkidle");
  const ann = await waitMail((m) => to(m).includes("zz1@example.com"));
  await new Promise((r) => setTimeout(r, 1000));
  const annAll = await mailpit();
  check("announcement skips the unsubscribed address", ann.length === 1 && !annAll.some((m) => to(m).includes("zz2@example.com")));
  check("sent page shows the skip", (await a.getByText("Skipped — unsubscribed").count()) === 1);

  // 9. Unsubscribe link from the real email
  const msg = await (await fetch(`${MP}/api/v1/message/${ann[0].ID}`)).json();
  const unsubHref = msg.HTML.match(/href="([^"]*\/unsubscribe\?[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  check("announcement contains an unsubscribe link", !!unsubHref);
  const g = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  g.on("pageerror", (e) => errs.push(e.message));
  await g.goto(unsubHref, { waitUntil: "networkidle" });
  await g.getByRole("button", { name: "Unsubscribe" }).click();
  await g.waitForSelector("text=You're unsubscribed");
  check("unsubscribe via link works", (await sql`select count(*)::int n from email_suppressions where email = 'zz1@example.com'`)[0].n === 1);
  await g.screenshot({ path: S + "em5-unsub.png" });
  await g.goto(unsubHref.replace(/t=[^&]+/, "t=tampered"), { waitUntil: "networkidle" });
  check("tampered unsubscribe link refused", (await g.getByText("This link doesn't work").count()) === 1);

  // 10. Recipient limit
  await sql`update app_settings set max_email_recipients = 1`;
  await a.goto(`${BASE}/admin/emails/send`, { waitUntil: "networkidle" });
  await a.locator("select").filter({ hasText: "Blank email" }).selectOption({ label: "Invite a vendor to join" });
  await a.getByRole("button", { name: "Email addresses" }).click();
  await a.locator('textarea[name="addresses"]').fill("zz3@example.com, zz4@example.com");
  await a.locator('input[name="confirm"]').fill("SEND");
  await a.getByRole("button", { name: "Send email" }).click();
  await a.waitForSelector("text=over the 1-recipient limit");
  check("recipient limit enforced", true);
  await sql`update app_settings set max_email_recipients = 500`;

  // 11. Security as a normal user
  const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await api.auth.signInWithPassword({ email: "vendortest@gather.dev", password: "GatherTest123!" });
  const r1 = await api.from("email_templates").select("id");
  const r2 = await api.from("admin_emails").select("id");
  const r3 = await api.from("email_suppressions").select("email");
  const r4 = await api.rpc("admin_email_audience", { p_segment: "everyone" });
  check("non-admin can't read email tables or the audience", !!r1.error && !!r2.error && !!r3.error && !!r4.error, [r1, r2, r3, r4].map((r) => r.error?.code).join(","));
  const v = await login("vendortest@gather.dev", 390);
  const res = await v.goto(BASE + "/admin/emails", { waitUntil: "networkidle" });
  check("non-admin gets 404 on /admin/emails", res.status() === 404);

  // 12. Profile toggle reflects suppression for own address
  await sql`insert into email_suppressions (email) values ('vendortest@gather.dev') on conflict do nothing`;
  await v.goto(BASE + "/profile", { waitUntil: "networkidle" });
  const boxOff = await v.locator('input[name="announcements"]').isChecked();
  await v.locator('input[name="announcements"]').check();
  await v.getByRole("button", { name: /save/i }).last().click();
  await v.waitForTimeout(2000);
  check("profile toggle reads and clears the opt-out", boxOff === false && (await sql`select count(*)::int n from email_suppressions where email = 'vendortest@gather.dev'`)[0].n === 0);

  // 13. Real reminder in the branded template
  await clearMail();
  const [ev] = await sql`insert into events (name, owner_id, start_at) values ('ZZMail wedding', ${VT}, now() + interval '40 days') returning id`;
  const [bk] = await sql`insert into event_vendors (event_id, vendor_id) values (${ev.id}, ${DRE}) returning id`;
  const [plan] = await sql`insert into payment_plans (event_vendor_id, total_amount, status) values (${bk.id}, 9000, 'active') returning id`;
  await sql`insert into payment_installments (payment_plan_id, installment_number, due_date, amount) values (${plan.id}, 1, current_date + 2, 4500)`;
  const v2 = await login("vendortest@gather.dev", 390);
  await v2.goto(BASE + "/", { waitUntil: "networkidle" });
  const rem = await waitMail((m) => m.Subject.startsWith("Payment due soon") && to(m).includes("vendortest@gather.dev"), 15000);
  check("payment reminder arrives on the branded template", rem.length >= 1, rem[0]?.Subject);
  if (rem[0]) {
    const full = await (await fetch(`${MP}/api/v1/message/${rem[0].ID}`)).json();
    check("reminder uses the layout (logo, button, footer)", full.HTML.includes("/icon-512.png") && full.HTML.includes("View this payment") && full.HTML.includes("email reminders are on"));
    const view = await (await b.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await view.setContent(full.HTML, { waitUntil: "networkidle" });
    await view.screenshot({ path: S + "em6-reminder.png", fullPage: true });
  }
  if (ann[0]) {
    const full = await (await fetch(`${MP}/api/v1/message/${ann[0].ID}`)).json().catch(() => null);
    if (full?.HTML) {
      const view = await (await b.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2 })).newPage();
      await view.setContent(full.HTML, { waitUntil: "networkidle" });
      await view.screenshot({ path: S + "em7-announcement.png", fullPage: true });
    }
  }
} finally {
  await sql`delete from event_vendors where event_id in (select id from events where name like 'ZZMail%')`;
  await sql`delete from events where name like 'ZZMail%'`;
  await sql`delete from payment_reminders where contact_user_id = (select id from auth.users where email = 'vendortest@gather.dev') and created_at > ${startedAt}`;
  await sql`delete from email_suppressions where email like 'zz%@example.com' or email = 'vendortest@gather.dev'`;
  for (const id of createdTemplates) await sql`delete from email_templates where id = ${id}`;
  await sql`delete from admin_emails where created_at > ${startedAt}`;
  await sql`update app_settings set max_email_recipients = 500`;
  await sql`delete from user_write_log`;
  await sql.end();
  await b.close();
}

finish();
