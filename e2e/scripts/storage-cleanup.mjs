// The unused-files cleanup: an old file no row points at is removed (really
// removed from storage, not just hidden), while a referenced file and a
// too-new file are left alone. Run from the admin Settings page, and the
// cron route refuses callers without the secret.
import { BASE, DRE_VENDOR_ID, ADMIN_EMAIL, check, finish, crash, sqlConnect, serviceClient, launchBrowser, login } from "../lib/harness.mjs";

const sql = sqlConnect();
const admin = serviceClient();
const bucket = "vendor-gallery";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const prefix = `zzcleanup-${Date.now()}`;
const files = { orphanOld: `${prefix}/orphan-old.png`, kept: `${prefix}/referenced.png`, orphanNew: `${prefix}/orphan-new.png` };
const exists = async (name) => !(await admin.storage.from(bucket).download(name)).error;
const browser = await launchBrowser();

try {
  for (const name of Object.values(files)) {
    const { error } = await admin.storage.from(bucket).upload(name, png, { contentType: "image/png" });
    if (error) throw error;
  }
  const [{ id: adminId }] = await sql`select id from auth.users where email = ${ADMIN_EMAIL}`;
  await sql`insert into vendor_gallery_images (vendor_id, storage_path, created_by) values (${DRE_VENDOR_ID}, ${files.kept}, ${adminId})`;
  await sql`update storage.objects set created_at = now() - interval '3 hours' where bucket_id = ${bucket} and name in (${files.orphanOld}, ${files.kept})`;

  const [{ n: seen }] = await sql`select count(*)::int n from orphaned_storage_objects(60) where name = ${files.orphanOld}`;
  const [{ n: seenKept }] = await sql`select count(*)::int n from orphaned_storage_objects(60) where name in (${files.kept}, ${files.orphanNew})`;
  check("the database lists the old unreferenced file, and neither the referenced nor the brand-new one", seen === 1 && seenKept === 0);

  const cron = await fetch(BASE + "/api/cron/storage-cleanup");
  check("the cron route refuses callers without the secret", cron.status === 401 || cron.status === 503, String(cron.status));
  const cronBad = await fetch(BASE + "/api/cron/storage-cleanup", { headers: { authorization: "Bearer wrong" } });
  check("…and with the wrong secret", cronBad.status === 401 || cronBad.status === 503, String(cronBad.status));

  const page = await login(browser, ADMIN_EMAIL);
  await page.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Run cleanup now" }).click();
  await page.getByText(/Removed \d+ unused file/).waitFor({ timeout: 30000 });
  check("the admin button reports what it removed", true);

  check("the old orphan is really gone from storage", !(await exists(files.orphanOld)));
  check("the referenced file is untouched", await exists(files.kept));
  check("the brand-new unreferenced file is untouched (might still be being saved)", await exists(files.orphanNew));

  // A signed-in non-admin can't call the listing function.
  const [{ n: rls }] = await sql`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'orphaned_storage_objects' and has_function_privilege('authenticated', p.oid, 'execute')`;
  check("signed-in users cannot run the orphan listing function", rls === 0);
} catch (e) {
  crash(e);
} finally {
  await browser.close();
  await sql`delete from vendor_gallery_images where storage_path like ${prefix + "/%"}`.catch(() => {});
  await admin.storage.from(bucket).remove(Object.values(files)).catch(() => {});
  await sql.end();
}
finish();
