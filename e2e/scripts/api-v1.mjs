// The native apps' API (/api/v1): every endpoint with no token, a bad token,
// the wrong person's token and the right token. The point is that the API
// enforces exactly what the website's own forms do, since both call the same
// service functions.
import { BASE, TEST_PASSWORD, ADMIN_EMAIL, check, finish, crash, sqlConnect, serviceClient, anonClient } from "../lib/harness.mjs";

const sql = sqlConnect();
const admin = serviceClient();
const made = [];

const mkUser = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (error) throw error;
  made.push(data.user.id);
  return data.user.id;
};
const tokenFor = async (email) => {
  const c = anonClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw error;
  return data.session.access_token;
};
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + "/api/v1" + path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, code: json?.error?.code };
}
const is = (r, status, code) => r.status === status && (code === undefined || r.code === code);
const note = (r) => `${r.status} ${r.code ?? ""}`;

try {
  // Clean up anything a crashed earlier run left behind.
  for (const e of ["zzapi-owner@gather.dev", "zzapi-stranger@gather.dev", "zzapi-ban@gather.dev", "zzapi-del@gather.dev"]) {
    const [u] = await sql`select id from auth.users where email = ${e}`;
    if (u) { await sql`delete from vendors where created_by = ${u.id}`.catch(() => {}); await admin.rpc("delete_account", { p_user: u.id }); }
  }
  await sql`delete from events where name like 'ZZAPI%'`;

  const ownerId = await mkUser("zzapi-owner@gather.dev");
  await mkUser("zzapi-stranger@gather.dev");
  const [{ id: adminId }] = await sql`select id from auth.users where email = ${ADMIN_EMAIL}`;
  const owner = await tokenFor("zzapi-owner@gather.dev");
  const stranger = await tokenFor("zzapi-stranger@gather.dev");

  // ---- /me
  check("GET /me without a token is 401", is(await call("GET", "/me"), 401, "unauthenticated"));
  check("GET /me with a garbage token is 401", is(await call("GET", "/me", { token: "not-a-token" }), 401, "unauthenticated"));
  const me = await call("GET", "/me", { token: owner });
  check("GET /me with a real token returns the person", me.status === 200 && me.json.data.email === "zzapi-owner@gather.dev", note(me));

  // ---- guest RSVP (no token)
  const [pub] = await sql`insert into events (name, owner_id, start_at, status, visibility) values ('ZZAPI public', ${adminId}, now() + interval '9 days', 'published', 'public') returning id`;
  const [priv] = await sql`insert into events (name, owner_id, start_at, status, visibility) values ('ZZAPI private', ${adminId}, now() + interval '9 days', 'published', 'private') returning id`;
  const rsvp = { name: "Guest Api", email: "guest-api@example.com", guestCount: 2 };
  const r1 = await call("POST", `/events/${pub.id}/rsvp`, { body: rsvp });
  const [{ n: rows }] = await sql`select count(*)::int n from event_attendees where event_id = ${pub.id} and email = 'guest-api@example.com'`;
  check("guest RSVP to a public event works without a token", is(r1, 201) && rows === 1, note(r1));
  check("guest RSVP to a private event is refused", is(await call("POST", `/events/${priv.id}/rsvp`, { body: rsvp }), 404, "not_accepting_rsvps"));
  check("guest RSVP with a bad email is a 400", is(await call("POST", `/events/${pub.id}/rsvp`, { body: { ...rsvp, email: "nope" } }), 400, "validation_error"));
  const bad = await fetch(BASE + `/api/v1/events/${pub.id}/rsvp`, { method: "POST", body: "{not json" });
  check("a body that isn't JSON is a 400", bad.status === 400);

  // ---- collaborators
  check("invite without a token is 401", is(await call("POST", `/events/${pub.id}/collaborators`, { body: { email: "zzapi-stranger@gather.dev", permissionLevel: "viewer" } }), 401));
  const inv = await call("POST", `/events/${pub.id}/collaborators`, { token: stranger, body: { email: "zzapi-owner@gather.dev", permissionLevel: "editor" } });
  const [{ n: strangerInvites }] = await sql`select count(*)::int n from event_collaborators where event_id = ${pub.id}`;
  check("a stranger can't invite people to someone else's event", inv.status >= 400 && strangerInvites === 0, note(inv));

  // ---- create a business
  check("POST /vendors without a token is 401", is(await call("POST", "/vendors", { body: { name: "ZZAPI Biz", primaryCategory: "Photography" } }), 401));
  check("POST /vendors with a missing name is 400", is(await call("POST", "/vendors", { token: owner, body: { primaryCategory: "Photography" } }), 400, "validation_error"));
  const v1 = await call("POST", "/vendors", { token: owner, body: { name: "ZZAPI Photos", primaryCategory: "Photography" } });
  const vendorId = v1.json?.data?.vendorId;
  const [m] = vendorId ? await sql`select role from vendor_team_members where vendor_id = ${vendorId} and user_id = ${ownerId}` : [];
  check("POST /vendors creates the business and makes the caller its owner", is(v1, 201) && m?.role === "owner", note(v1));
  const v2 = await call("POST", "/vendors", { token: owner, body: { name: "ZZAPI Photos Two", primaryCategory: "Photography" } });
  check("a second business in the same category is blocked, with details", is(v2, 409, "business_rules_blocked") && v2.json.error.details?.blocked?.duplicateCategory === true, note(v2));

  // ---- exception request
  const br1 = await call("POST", "/business-requests", { token: owner, body: { name: "ZZAPI Photos Two", primaryCategory: "Photography", reason: "A separate studio for weddings." } });
  check("an exception request is accepted when a rule applies", is(br1, 201), note(br1));
  const br2 = await call("POST", "/business-requests", { token: owner, body: { name: "ZZAPI Photos Three", primaryCategory: "Photography", reason: "Another separate studio." } });
  check("a second open request is refused", is(br2, 409, "already_pending"), note(br2));
  const br3 = await call("POST", "/business-requests", { token: stranger, body: { name: "ZZAPI Fine", primaryCategory: "Catering", reason: "No rule applies here at all." } });
  check("an exception request nobody needs is refused", is(br3, 409, "not_needed"), note(br3));

  // ---- update a business
  const patch = { name: "ZZAPI Photos Renamed", primaryCategory: "Photography" };
  check("PATCH /vendors/{id} without a token is 401", is(await call("PATCH", `/vendors/${vendorId}`, { body: patch }), 401));
  const pStranger = await call("PATCH", `/vendors/${vendorId}`, { token: stranger, body: patch });
  check("a stranger can't edit someone else's business", pStranger.status === 403, note(pStranger));
  const pOwner = await call("PATCH", `/vendors/${vendorId}`, { token: owner, body: patch });
  check("the owner can edit their business", is(pOwner, 200), note(pOwner));

  // ---- featured spot
  const fBody = { spot: "rotating", duration: "1_month", startsOn: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) };
  check("featured request without a token is 401", is(await call("POST", `/vendors/${vendorId}/featured-requests`, { body: fBody }), 401));
  check("a stranger can't request a spot for someone else's business", is(await call("POST", `/vendors/${vendorId}/featured-requests`, { token: stranger, body: fBody }), 403, "not_owner"));
  const f1 = await call("POST", `/vendors/${vendorId}/featured-requests`, { token: owner, body: fBody });
  check("the owner can request a featured spot", is(f1, 201), note(f1));
  check("a second pending request is refused", is(await call("POST", `/vendors/${vendorId}/featured-requests`, { token: owner, body: fBody }), 409, "already_pending"));
  const [pl] = await sql`select id, status from vendor_feature_placements where vendor_id = ${vendorId}`;
  check("the request is pending (nothing goes live by itself)", pl?.status === "pending");
  check("a stranger can't withdraw it", is(await call("DELETE", `/vendors/${vendorId}/featured-requests/${pl.id}`, { token: stranger }), 403, "not_owner"));
  const w = await call("DELETE", `/vendors/${vendorId}/featured-requests/${pl.id}`, { token: owner });
  check("the owner can withdraw it", is(w, 200), note(w));
  check("withdrawing again finds nothing", is(await call("DELETE", `/vendors/${vendorId}/featured-requests/${pl.id}`, { token: owner }), 404, "not_found"));

  // ---- reminders
  check("reminders check without a token is 401", is(await call("POST", "/reminders/check"), 401));
  check("reminders check with a token is 200", is(await call("POST", "/reminders/check", { token: owner }), 200));

  // ---- a suspended person's token
  await mkUser("zzapi-ban@gather.dev");
  const banTok = await tokenFor("zzapi-ban@gather.dev");
  const [{ id: banId }] = await sql`select id from auth.users where email = 'zzapi-ban@gather.dev'`;
  await admin.auth.admin.updateUserById(banId, { ban_duration: "876000h" });
  const banned = await call("GET", "/me", { token: banTok });
  check("a suspended account's existing token stops working at once", banned.status === 401, note(banned));

  // ---- delete my account
  const delId = await mkUser("zzapi-del@gather.dev");
  const delTok = await tokenFor("zzapi-del@gather.dev");
  check("DELETE /me without a token is 401", is(await call("DELETE", "/me", { body: { confirm: "DELETE" } }), 401));
  check("DELETE /me without the typed confirmation is 400", is(await call("DELETE", "/me", { token: delTok, body: { confirm: "yes" } }), 400, "validation_error"));
  const del = await call("DELETE", "/me", { token: delTok, body: { confirm: "DELETE" } });
  const [{ n: gone }] = await sql`select count(*)::int n from auth.users where id = ${delId}`;
  check("DELETE /me with the confirmation deletes the account", is(del, 200) && gone === 0, note(del));
  check("the deleted account's token no longer works", is(await call("GET", "/me", { token: delTok }), 401));
} catch (e) {
  crash(e);
} finally {
  await sql`delete from vendor_feature_placements where vendor_id in (select id from vendors where name like 'ZZAPI%')`.catch(() => {});
  await sql`delete from vendor_business_requests where business_name like 'ZZAPI%'`.catch(() => {});
  await sql`delete from vendors where name like 'ZZAPI%'`.catch(() => {});
  await sql`delete from events where name like 'ZZAPI%'`.catch(() => {});
  for (const id of made) {
    const { error } = await admin.rpc("delete_account", { p_user: id });
    if (error) await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  await sql.end();
}
finish();
