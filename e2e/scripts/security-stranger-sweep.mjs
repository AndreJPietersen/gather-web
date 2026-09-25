// "Who can edit" check, Salesforce-sharing style: a brand-new account with no
// relationship to anything (not owner, admin, co-planner or vendor team
// member) tries to UPDATE a real row in every table, and to DELETE rows
// belonging to someone else. Updates write a column back to its current
// value, so even a hole would change nothing; deletes only target fixture rows
// created for this test.
import { env, check, finish, sqlConnect } from "../lib/harness.mjs";
import { createClient } from "@supabase/supabase-js";
const sql = sqlConnect();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: made } = await admin.auth.admin.createUser({ email: "zzstranger@gather.dev", password: "GatherTest123!", email_confirm: true });
const STRANGER = made.user.id;
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
await api.auth.signInWithPassword({ email: "zzstranger@gather.dev", password: "GatherTest123!" });
const [{ id: OWNER }] = await sql`select id from auth.users where email = 'phonetest@gather.dev'`;
const lines = [];
let holes = 0;

try {
  // --- Updates on every table with an id and at least one row.
  const tables = await sql`
    select t.table_name,
      (select c.column_name from information_schema.column_privileges c
        where c.table_schema = 'public' and c.table_name = t.table_name and c.grantee = 'authenticated'
          and c.privilege_type = 'UPDATE' and c.column_name <> 'id' order by c.column_name limit 1) as col
    from information_schema.tables t
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and exists (select 1 from information_schema.columns k where k.table_schema='public' and k.table_name=t.table_name and k.column_name='id')
    order by 1`;
  for (const { table_name: t, col } of tables) {
    const rows = await sql.unsafe(`select id${col ? `, "${col}" as v` : ""} from public."${t}" limit 50`);
    // Rows the stranger has no relationship with (they own nothing yet).
    if (rows.length === 0) { lines.push(`  -        ${t}: no rows to test`); continue; }
    if (!col) { lines.push(`  locked   ${t}: no editable columns for signed-in users at all`); continue; }
    let changed = 0, firstErr = "";
    for (const r of rows) {
      const { data, error } = await api.from(t).update({ [col]: r.v }).eq("id", r.id).select("id");
      if (error && !firstErr) firstErr = error.message;
      if ((data ?? []).length > 0) changed++;
    }
    if (changed > 0) holes++;
    lines.push(`${changed > 0 ? "  HOLE   " : "  blocked"}  ${t}: ${changed}/${rows.length} rows editable${firstErr ? ` (${firstErr})` : ""}`);
  }

  // --- Deletes on fixture rows owned by someone else.
  const [ev] = await sql`insert into events (name, owner_id, start_at, status, visibility) values ('ZZS public event', ${OWNER}, now() + interval '20 days', 'published', 'public') returning id`;
  await sql`insert into event_attendees (event_id, name) values (${ev.id}, 'ZZS guest')`;
  await sql`insert into event_tasks (event_id, title) values (${ev.id}, 'ZZS task')`.catch(() => {});
  await sql`insert into budget_items (event_id, name, budgeted_amount) values (${ev.id}, 'ZZS item', 100)`.catch(() => {});
  const [vd] = await sql`insert into vendors (name, created_by, verification_status) values ('ZZS vendor', ${OWNER}, 'verified') returning id`;
  await sql`insert into vendor_team_members (vendor_id, user_id, role) values (${vd.id}, ${OWNER}, 'owner')`;
  await sql`insert into vendor_services (vendor_id, name) values (${vd.id}, 'ZZS service')`.catch(() => {});
  const targets = [
    ["events", sql`select id from events where id = ${ev.id}`],
    ["event_attendees", sql`select id from event_attendees where event_id = ${ev.id}`],
    ["event_tasks", sql`select id from event_tasks where event_id = ${ev.id}`],
    ["budget_items", sql`select id from budget_items where event_id = ${ev.id}`],
    ["vendors", sql`select id from vendors where id = ${vd.id}`],
    ["vendor_team_members", sql`select id from vendor_team_members where vendor_id = ${vd.id}`],
    ["vendor_services", sql`select id from vendor_services where vendor_id = ${vd.id}`],
  ];
  lines.push("");
  for (const [t, q] of targets) {
    const rows = await q;
    if (rows.length === 0) { lines.push(`  -        delete ${t}: fixture not created`); continue; }
    await api.from(t).delete().in("id", rows.map((r) => r.id));
    const still = await sql.unsafe(`select count(*)::int n from public."${t}" where id = any($1)`, [rows.map((r) => r.id)]);
    const deleted = rows.length - still[0].n;
    if (deleted > 0) holes++;
    lines.push(`${deleted > 0 ? "  HOLE   " : "  blocked"}  delete ${t}: ${deleted}/${rows.length} deleted`);
  }
  // Reading a public event is fine (it's public); editing it must not be.
  const { data: seen } = await api.from("events").select("id").eq("id", ev.id);
  lines.push(`\n  (public event visible to the stranger: ${(seen ?? []).length === 1 ? "yes, read-only as intended" : "no"})`);
} finally {
  await sql`delete from vendors where name like 'ZZS%'`;
  await sql`delete from events where name like 'ZZS%'`;
  await admin.auth.admin.deleteUser(STRANGER);
  console.log(lines.join("\n"));
  check("a stranger can't edit or delete other users' data in any table", holes === 0, holes === 0 ? "" : `${holes} hole(s) — see the HOLE lines above`);
  await sql.end();
}

finish();
