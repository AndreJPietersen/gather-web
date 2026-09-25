// Prints a sorted, normalised fingerprint of everything structure- and
// security-relevant in a database, one item per line, so two databases can be
// compared: tables, columns, constraints, indexes, RLS policies (including
// storage), functions and their grants, triggers, table and column grants,
// enums, storage buckets, realtime publication, default privileges, and the
// migration-seeded rows. Read-only.
//
//   node scripts/fingerprint.mjs <db-url> > a.txt
//   node scripts/fingerprint.mjs <other-db-url> > b.txt   then   diff a.txt b.txt
//
// Use it to prove a freshly built database equals a long-lived one, or that QA
// and production haven't drifted apart.
import postgres from "postgres";

const sql = postgres(process.argv[2], { onnotice: () => {} });
const out = [];
const add = (kind, s) => out.push(`${kind}\t${String(s).replace(/\s+/g, " ").trim()}`);

for (const r of await sql`
  select c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable, coalesce(c.column_default,'') d
  from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'`)
  add("column", `${r.table_name}.${r.column_name} ${r.udt_name} null=${r.is_nullable} default=${r.d}`);

for (const r of await sql`
  select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'`) add("rls", `${r.relname} enabled=${r.relrowsecurity} forced=${r.relforcerowsecurity}`);

for (const r of await sql`
  select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) def from pg_constraint
  where connamespace = 'public'::regnamespace`) add("constraint", `${r.t} ${r.conname} ${r.def}`);

for (const r of await sql`select indexdef from pg_indexes where schemaname='public'`) add("index", r.indexdef);

for (const r of await sql`
  select schemaname, tablename, policyname, cmd, roles::text, coalesce(qual,'') q, coalesce(with_check,'') w
  from pg_policies where schemaname in ('public','storage')`)
  add("policy", `${r.schemaname}.${r.tablename} ${r.policyname} ${r.cmd} ${r.roles} USING(${r.q}) CHECK(${r.w})`);

for (const r of await sql`
  select p.proname, pg_get_function_identity_arguments(p.oid) args, pg_get_functiondef(p.oid) def,
         p.prosecdef, p.provolatile, coalesce(p.proconfig::text,'') cfg
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind='f'`)
  add("function", `${r.proname}(${r.args}) secdef=${r.prosecdef} vol=${r.provolatile} cfg=${r.cfg} ${r.def}`);

for (const r of await sql`
  select p.proname, pg_get_function_identity_arguments(p.oid) args,
         has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u,
         has_function_privilege('service_role', p.oid, 'execute') s
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind='f'`)
  add("fn-grant", `${r.proname}(${r.args}) anon=${r.a} authenticated=${r.u} service_role=${r.s}`);

for (const r of await sql`
  select t.tgname, c.relname, n.nspname, pg_get_triggerdef(t.oid) def from pg_trigger t
  join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and n.nspname in ('public','auth','storage')`)
  add("trigger", `${r.nspname}.${r.relname} ${r.def}`);

// table-level privileges for the API roles
for (const r of await sql`
  select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) p
  from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated','service_role')
  group by 1,2`) add("table-grant", `${r.grantee} ${r.table_name} ${r.p}`);

// column-level privileges (only those not implied by a table-level grant)
for (const r of await sql`
  select grantee, table_name, column_name, string_agg(privilege_type, ',' order by privilege_type) p
  from information_schema.column_privileges
  where table_schema='public' and grantee in ('anon','authenticated')
    and not exists (select 1 from information_schema.role_table_grants g where g.table_schema='public'
       and g.table_name=column_privileges.table_name and g.grantee=column_privileges.grantee
       and g.privilege_type=column_privileges.privilege_type)
  group by 1,2,3`) add("col-grant", `${r.grantee} ${r.table_name}.${r.column_name} ${r.p}`);

for (const r of await sql`
  select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) l from pg_type t join pg_enum e on e.enumtypid=t.oid
  where t.typnamespace='public'::regnamespace group by 1`) add("enum", `${r.typname} ${r.l}`);

for (const r of await sql`select id, public, file_size_limit, allowed_mime_types::text m from storage.buckets`)
  add("bucket", `${r.id} public=${r.public} limit=${r.file_size_limit} mime=${r.m}`);

for (const r of await sql`select tablename from pg_publication_tables where pubname='supabase_realtime'`) add("realtime", r.tablename);

// Default privileges for objects OUR migrations create (owner role postgres).
// Ignored on purpose: the platform's own supabase_admin defaults, and the
// owner's explicit self-entry (postgres=...), neither of which comes from
// migrations and neither of which changes what anon/authenticated can do.
for (const r of await sql`select defaclrole::regrole::text who, defaclobjtype t, defaclacl::text a from pg_default_acl`) {
  if (r.who !== "postgres") continue;
  const acl = r.a.replace(/^{|}$/g, "").split(",").filter((e) => !e.startsWith("postgres=")).join(",");
  add("default-acl", `${r.who} ${r.t} {${acl}}`);
}

// migration-seeded data
for (const r of await sql`select key, name, kind, category from email_templates order by key nulls last, name`) add("seed-email", `${r.key} ${r.name} ${r.kind} ${r.category}`);
for (const r of await sql`select spot, duration from feature_prices order by 1,2`) add("seed-price", `${r.spot} ${r.duration}`);
for (const r of await sql`select table_name, label, max_per_hour from write_rate_limits order by 1`) add("seed-limit", `${r.table_name} ${r.label} ${r.max_per_hour}`);
for (const r of await sql`select featured_enabled, registration_enabled, listing_daily_limit, max_owned_businesses, max_email_recipients from app_settings`)
  add("seed-settings", JSON.stringify(r));

out.sort();
console.log(out.join("\n"));
await sql.end();
