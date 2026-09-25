import { S, env, BASE, errs, check, finish, sqlConnect, launchBrowser } from "../lib/harness.mjs";
import { createClient } from "@supabase/supabase-js";
const sql = sqlConnect();
const b = await launchBrowser();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const client = async (email) => {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: "GatherTest123!" });
  return c;
};
const DRE = "03abd193-63d9-4ecc-94b6-85b8bb07a1a2";
let staffId;

try {
  const { data: made } = await admin.auth.admin.createUser({ email: "zzstaff@gather.dev", password: "GatherTest123!", email_confirm: true });
  staffId = made.user.id;
  await sql`update profiles set display_name = 'Sam Staff' where id = ${staffId}`;
  await sql`insert into vendor_team_members (vendor_id, user_id, role) values (${DRE}, ${staffId}, 'staff')`;
  const [{ id: PLANNER }] = await sql`select id from auth.users where email = 'phonetest@gather.dev'`;
  const [ev] = await sql`insert into events (name, owner_id, start_at) values ('ZZStaff wedding', ${PLANNER}, now() + interval '60 days') returning id`;
  const [bk] = await sql`insert into event_vendors (event_id, vendor_id, status) values (${ev.id}, ${DRE}, 'shortlisted') returning id`;
  const [sent] = await sql`insert into vendor_quotes (event_vendor_id, amount, status) values (${bk.id}, 12000, 'sent') returning id`;
  const [plan] = await sql`insert into payment_plans (event_vendor_id, total_amount) values (${bk.id}, 12000) returning id`;
  await sql`insert into payment_installments (payment_plan_id, installment_number, due_date, amount) values (${plan.id}, 1, current_date + 10, 6000)`;

  const staff = await client("zzstaff@gather.dev");
  const owner = await client("vendortest@gather.dev");
  const planner = await client("phonetest@gather.dev");

  // Visibility
  const { data: sb } = await staff.from("event_vendors").select("id").eq("id", bk.id);
  check("staff sees the booking", sb?.length === 1);
  const { data: sq } = await staff.from("vendor_quotes").select("id, amount").eq("event_vendor_id", bk.id);
  check("staff can't see the sent quote's price", sq?.length === 0);
  const { data: sp } = await staff.from("payment_plans").select("id").eq("event_vendor_id", bk.id);
  const { data: si } = await staff.from("payment_installments").select("id").eq("payment_plan_id", plan.id);
  check("staff can't see payment plans or installments", sp?.length === 0 && si?.length === 0);
  const { data: op } = await owner.from("payment_plans").select("id").eq("event_vendor_id", bk.id);
  check("(control) owner still sees payment plans", op?.length === 1);

  // Quote suggestions
  const { error: sendErr } = await staff.from("vendor_quotes").insert({ event_vendor_id: bk.id, amount: 1, status: "sent" });
  check("staff can't send a quote directly", !!sendErr);
  const { data: draft, error: dErr } = await staff.from("vendor_quotes").insert({ event_vendor_id: bk.id, amount: 15000, status: "draft", suggested_by: staffId }).select("id").single();
  check("staff can suggest a quote (draft)", !!draft, dErr?.message);
  const { data: pq } = await planner.from("vendor_quotes").select("id, status").eq("event_vendor_id", bk.id);
  check("planner doesn't see the suggestion", pq?.length === 1 && pq[0].status === "sent");
  const { data: oq } = await owner.from("vendor_quotes").select("id, status").eq("event_vendor_id", bk.id);
  check("owner sees the suggestion", oq?.some((q) => q.status === "draft"));
  const { error: fakeAccept } = await owner.from("vendor_quotes").update({ status: "accepted" }).eq("id", sent.id);
  const [sentNow] = await sql`select status from vendor_quotes where id = ${sent.id}`;
  check("owner can't mark their own quote accepted", sentNow.status === "sent", fakeAccept?.message);
  const { error: fakeInsert } = await owner.from("vendor_quotes").insert({ event_vendor_id: bk.id, amount: 5, status: "accepted" });
  check("owner can't create an already-accepted quote", !!fakeInsert);
  const { error: backToDraft } = await planner.from("vendor_quotes").update({ status: "draft" }).eq("id", sent.id);
  const [sentAfter] = await sql`select status from vendor_quotes where id = ${sent.id}`;
  check("planner can't push a sent quote back to draft", sentAfter.status === "sent", backToDraft?.message);
  const { error: staffDelSent } = await staff.from("vendor_quotes").delete().eq("id", sent.id);
  check("staff can't delete a sent quote", (await sql`select count(*)::int n from vendor_quotes where id = ${sent.id}`)[0].n === 1, staffDelSent?.message);

  // Team notes
  const { error: nErr } = await staff.from("vendor_booking_notes").upsert({ event_vendor_id: bk.id, body: "Gate code 4411", updated_by: staffId }, { onConflict: "event_vendor_id" });
  check("staff can write a team note", !nErr, nErr?.message);
  const { data: pn } = await planner.from("vendor_booking_notes").select("body").eq("event_vendor_id", bk.id);
  check("planner can't see the team note", pn?.length === 0);
  const { data: on } = await owner.from("vendor_booking_notes").select("body").eq("event_vendor_id", bk.id);
  check("owner sees the team note", on?.[0]?.body === "Gate code 4411");

  // Gallery
  const { data: g, error: gErr } = await staff.from("vendor_gallery_images").insert({ vendor_id: DRE, storage_path: `${DRE}/zzstaff-test.jpg`, created_by: staffId }).select("id").single();
  check("staff can add a gallery photo", !!g, gErr?.message);
  if (g) {
    await staff.from("vendor_gallery_images").delete().eq("id", g.id);
    check("staff can't delete a gallery photo", (await sql`select count(*)::int n from vendor_gallery_images where id = ${g.id}`)[0].n === 1);
    await sql`delete from vendor_gallery_images where id = ${g.id}`;
  }

  // Screens as Staff
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "zzstaff@gather.dev");
  await p.fill('input[name="password"]', "GatherTest123!");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"));
  await p.goto(`${BASE}/vendor/${DRE}/dashboard`, { waitUntil: "networkidle" });
  check("dashboard hides Payments from staff", (await p.getByText("Payments", { exact: true }).count()) === 0);
  await p.goto(`${BASE}/vendor/${DRE}/dashboard/payments`, { waitUntil: "networkidle" });
  check("payments page explains it's Owner/Manager only", (await p.getByText("only visible to this business").count()) === 1);
  await p.goto(`${BASE}/vendor/${DRE}/dashboard/bookings`, { waitUntil: "networkidle" });
  const card = p.locator("div.rounded-\\[22px\\]", { hasText: "ZZStaff wedding" }).first();
  check("staff sees their pending suggestion", (await card.getByText(/Your suggestion: .*waiting for a Manager/).count()) === 1);
  check("staff sees 'Suggest a Quote'", (await card.getByRole("button", { name: "Suggest a Quote" }).count()) === 1);
  check("staff sees the team note", (await card.locator("textarea").inputValue()) === "Gate code 4411");
  await card.locator("textarea").fill("Gate code 4411. Parking behind the barn.");
  await card.getByRole("button", { name: "Save note" }).click();
  await p.waitForTimeout(1500);
  check("staff saves the note through the UI", (await sql`select body from vendor_booking_notes where event_vendor_id = ${bk.id}`)[0].body.includes("barn"));
  await card.scrollIntoViewIfNeeded();
  await p.screenshot({ path: S + "st1-staff-bookings.png", fullPage: true });

  // Owner approves the suggestion in the UI
  const o = await (await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })).newPage();
  o.on("pageerror", (e) => errs.push(e.message));
  await o.goto(BASE + "/login", { waitUntil: "networkidle" });
  await o.fill('input[name="email"]', "vendortest@gather.dev");
  await o.fill('input[name="password"]', "GatherTest123!");
  await o.click('button[type="submit"]');
  await o.waitForURL((u) => !u.pathname.includes("/login"));
  await o.goto(`${BASE}/vendor/${DRE}/dashboard/bookings`, { waitUntil: "networkidle" });
  const ocard = o.locator("div.rounded-\\[22px\\]", { hasText: "ZZStaff wedding" }).first();
  check("owner sees 'Suggested by Sam Staff'", (await ocard.getByText(/Suggested by Sam Staff/).count()) === 1);
  await o.screenshot({ path: S + "st2-owner-bookings.png", fullPage: true });
  await ocard.getByRole("button", { name: "Send to planner" }).click();
  await o.waitForTimeout(1500);
  const { data: pq2 } = await planner.from("vendor_quotes").select("amount, status").eq("event_vendor_id", bk.id);
  check("after approval the planner sees the suggested quote", pq2?.some((q) => Number(q.amount) === 15000 && q.status === "sent"));
  const { error: acceptErr } = await planner.from("vendor_quotes").update({ status: "accepted" }).eq("id", sent.id);
  check("(control) planner can still accept a quote", !acceptErr && (await sql`select status from vendor_quotes where id = ${sent.id}`)[0].status === "accepted", acceptErr?.message);
} finally {
  await sql`delete from event_vendors where event_id in (select id from events where name like 'ZZStaff%')`;
  await sql`delete from events where name like 'ZZStaff%'`;
  if (staffId) {
    await sql`delete from vendor_team_members where user_id = ${staffId}`;
    await sql`delete from user_write_log where user_id = ${staffId}`;
    await admin.auth.admin.deleteUser(staffId);
  }
  await sql.end();
  await b.close();
}

finish();
