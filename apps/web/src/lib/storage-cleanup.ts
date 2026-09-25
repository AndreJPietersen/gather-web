import { createServiceClient } from "@/lib/supabase/service";
import { getStorageCleanupMinAgeMinutes } from "@/lib/app-settings";

export interface StorageCleanupResult {
  found: number;
  removed: number;
  failed: number;
  byBucket: Record<string, number>;
}

// Deleting a database row never deletes the uploaded file it pointed at, so
// events, photos, messages and accounts that get deleted leave files behind
// (and, for a deleted account, personal photos we're obliged to erase). The
// database function orphaned_storage_objects() lists the files no row refers
// to any more that are older than the admin-set minimum age; this removes
// them through the Storage API (deleting storage.objects rows in SQL would
// leave the file itself in place).
//
// Run from: the Profile "delete my account" action (best effort), the daily
// cron route /api/cron/storage-cleanup, and the button on /admin/settings.
export async function cleanupOrphanedStorage(): Promise<StorageCleanupResult> {
  const service = createServiceClient();
  const minAge = await getStorageCleanupMinAgeMinutes();
  const { data, error } = await service.rpc("orphaned_storage_objects", { p_min_age_minutes: minAge });
  if (error) throw new Error(error.message);

  const byBucket = new Map<string, string[]>();
  for (const row of (data ?? []) as { bucket_id: string; name: string }[]) {
    byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row.name]);
  }

  const result: StorageCleanupResult = { found: 0, removed: 0, failed: 0, byBucket: {} };
  for (const [bucket, names] of byBucket) {
    result.found += names.length;
    for (let i = 0; i < names.length; i += 100) {
      const batch = names.slice(i, i + 100);
      const { data: removed, error: removeError } = await service.storage.from(bucket).remove(batch);
      if (removeError) {
        result.failed += batch.length;
      } else {
        result.removed += removed?.length ?? 0;
        result.byBucket[bucket] = (result.byBucket[bucket] ?? 0) + (removed?.length ?? 0);
      }
    }
  }
  return result;
}
