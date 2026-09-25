// Account deletion: erases what should go, keeps what belongs to others
// (re-pointed at the "Deleted user" placeholder), and can't be called by a
// signed-in user directly.
import { check, finish, crash, sqlConnect, serviceClient, userClient, ADMIN_EMAIL, TEST_PASSWORD } from "../lib/harness.mjs";

const sql = sqlConnect();
const admin = serviceClient();
const TOMB = "00000000-0000-4000-8000-00000000dead";
const email = "zzdelete@gather.dev";
let uid, vendorId, otherEventId;

try {
  const { data: made, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (error) throw error;
  uid = made.user.id;
  const [{ id: adminId }] = await sql`select id from auth.users where email = ${ADMIN_EMAIL}`;

  // Their own event with a guest, and a business they alone run.
  const [ev] = await sql`insert into events (name, owner_id, start_at, status, visibility) values ('ZZD my event', ${uid}, now() + interval '10 days', 'published', 'private') returning id`;
  await sql`insert into event_attendees (event_id, name) values (${ev.id}, 'ZZD guest')`;
  const [vd] = await sql`insert into vendors (name, created_by, verification_status) values ('ZZD business', ${uid}, 'verified') returning id`;
  vendorId = vd.id;
  await sql`insert into vendor_team_members (vendor_id, user_id, role) values (${vendorId}, ${uid}, 'owner')`;

  // Something they wrote on someone else's booking (must survive, anonymised).
  const [oev] = await sql`insert into events (name, owner_id, start_at, status, visibility) values ('ZZD other event', ${adminId}, now() + interval '10 days', 'published', 'private') returning id`;
  otherEventId = oev.id;
  const [ov] = await sql`insert into event_vendors (event_id, vendor_id, status) values (${otherEventId}, ${vendorId}, 'shortlisted') returning id`;
  await sql`insert into event_vendor_messages (event_vendor_id, sender_id, body) values (${ov.id}, ${uid}, 'ZZD hello')`;

  // A signed-in user can't call the function (not even on themselves).
  const me = await userClient(email);
  const { error: denied } = await me.rpc("delete_account", { p_user: uid });
  check("a signed-in user cannot call delete_account directly", !!denied, denied?.code ?? "");
  const [{ n: still }] = await sql`select count(*)::int n from auth.users where id = ${uid}`;
  check("account still exists after the denied call", still === 1);

  // Admins must step down first.
  await sql`update profiles set is_admin = true where id = ${uid}`;
  const { error: adminErr } = await admin.rpc("delete_account", { p_user: uid });
  check("an admin account is refused until demoted", !!adminErr);
  await sql`update profiles set is_admin = false where id = ${uid}`;

  const { error: delErr } = await admin.rpc("delete_account", { p_user: uid });
  check("deletion succeeds", !delErr, delErr?.message ?? "");

  const [{ n: gone }] = await sql`select count(*)::int n from auth.users where id = ${uid}`;
  const [{ n: prof }] = await sql`select count(*)::int n from profiles where id = ${uid}`;
  check("sign-in and profile are gone", gone === 0 && prof === 0);
  const [{ n: evs }] = await sql`select count(*)::int n from events where id = ${ev.id}`;
  const [{ n: guests }] = await sql`select count(*)::int n from event_attendees where event_id = ${ev.id}`;
  check("their event and its guests are deleted", evs === 0 && guests === 0);
  const [v] = await sql`select hidden_at, created_by from vendors where id = ${vendorId}`;
  check("a business they alone ran is hidden, not deleted", !!v?.hidden_at);
  check("the business now points at the placeholder", v?.created_by === TOMB);
  const [m] = await sql`select sender_id from event_vendor_messages where body = 'ZZD hello'`;
  check("their message on someone else's booking is kept, as 'Deleted user'", m?.sender_id === TOMB);
  const [{ n: mem }] = await sql`select count(*)::int n from vendor_team_members where user_id = ${uid}`;
  check("they are off every business team", mem === 0);

  const { error: tombErr } = await admin.rpc("delete_account", { p_user: TOMB });
  check("the placeholder itself can't be deleted", !!tombErr);
} catch (e) {
  crash(e);
} finally {
  await sql`delete from events where name like 'ZZD%'`.catch(() => {});
  await sql`delete from vendors where name like 'ZZD%'`.catch(() => {});
  if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {});
  await sql.end();
}
finish();
