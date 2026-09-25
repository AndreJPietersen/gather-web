// Catalogue of what the database exposes to the public API roles, plus
// guards that fail if something new is exposed by accident. Read-only.
import { check, finish, sqlConnect } from "../lib/harness.mjs";
const sql = sqlConnect();
const show = (t, r) => {
  console.log(`\n== ${t} (${r.length})`);
  for (const x of r) console.log("  " + JSON.stringify(x));
};

// Reviewed helpers that RLS policies and triggers call. A NEW SECURITY
// DEFINER function callable by anon/authenticated must be added here on
// purpose, after asking "what can a stranger learn or do by calling it?"
const REVIEWED_PUBLIC_FUNCTIONS = new Set([
  "check_installment_sum_within_plan",
  "featured_rank",
  "handle_new_user",
  "invite_email_matches_current_user",
  "is_admin",
  "is_event_collaborator",
  "is_event_owner",
  "is_event_pending_invitee",
  "is_featured",
  "is_vendor_creator",
  "is_vendor_team_member",
  "is_vendor_verified",
]);

const noRls = await sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
show("public tables WITHOUT row level security", noRls);
check("every public table has RLS enabled", noRls.length === 0, noRls.map((r) => r.relname).join(", "));

const views = await sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('v', 'm')`;
show("views in public (they bypass RLS unless security_invoker)", views);
check("no views in the public schema", views.length === 0, views.map((r) => r.relname).join(", "));

const anonWrites = await sql`select table_name, string_agg(privilege_type, ',') privileges from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE') group by 1`;
show("tables anonymous visitors can write to", anonWrites);
check("anonymous visitors can't write to any table", anonWrites.length === 0, anonWrites.map((r) => r.table_name).join(", "));

const truncate = await sql`select distinct table_name from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema = 'public' and privilege_type = 'TRUNCATE'`;
check("nobody but the service role can TRUNCATE", truncate.length === 0, truncate.map((r) => r.table_name).join(", "));

const fns = await sql`select p.proname, pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) order by 1`;
show("SECURITY DEFINER functions callable by anon/authenticated", fns);
const unreviewed = fns.filter((f) => !REVIEWED_PUBLIC_FUNCTIONS.has(f.proname));
check("no unreviewed SECURITY DEFINER function is callable by users", unreviewed.length === 0, unreviewed.map((f) => f.proname).join(", "));

show("storage buckets", await sql`select id, public, file_size_limit, allowed_mime_types from storage.buckets`);
const noLimit = await sql`select id from storage.buckets where file_size_limit is null`;
check("every storage bucket has a file size limit", noLimit.length === 0, noLimit.map((r) => r.id).join(", "));
show("role timeouts", await sql`select r.rolname, s.setconfig from pg_roles r left join pg_db_role_setting s on s.setrole = r.oid where r.rolname in ('anon','authenticated','authenticator')`);

await sql.end();
finish();
