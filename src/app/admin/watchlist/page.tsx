import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getWatchlist, getWatchlistThresholds, signalInfo, SIGNAL_ORDER, type WatchlistRow } from "@/lib/admin/watchlist";
import { dismissWatchlistEntryAction, hideVendorsAction, undoDismissalAction } from "../moderation/actions";

// Early-warning patterns for marketplace flooding. Deliberately a report, not
// a gate — real businesses sometimes trip these (an agency managing several
// vendors, say), so an admin looks and decides. Computed live on every load;
// hidden listings and suspended users drop out on their own.
export default async function AdminWatchlistPage() {
  await requireAdmin();
  const thresholds = await getWatchlistThresholds();
  const { active, dismissed } = await getWatchlist(thresholds);
  const SIGNAL_INFO = signalInfo(thresholds);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">Watchlist</h1>
        <p className="text-sm font-semibold text-text-muted">
          Thresholds are set on the <Link href="/admin/settings" className="font-extrabold text-primary">Settings</Link> page.
          Patterns worth a look — someone creating lots of listings, sitting on many teams, or posting look-alike
          businesses. Nothing here is blocked automatically: hide listings, suspend the account from their user page, or
          dismiss the entry if it&apos;s fine.
        </p>
      </div>

      {active.length === 0 ? (
        <Card>
          <p className="text-sm font-semibold text-text-muted">Nothing unusual right now.</p>
        </Card>
      ) : (
        SIGNAL_ORDER.map((signal) => {
          const group = active.filter((r) => r.signal === signal);
          if (group.length === 0) return null;
          return (
            <section key={signal} className="flex flex-col gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  {SIGNAL_INFO[signal].title} ({group.length})
                </h2>
                <p className="text-xs font-semibold text-text-muted">{SIGNAL_INFO[signal].explain}</p>
              </div>
              {group.map((row) => (
                <WatchlistEntry key={`${signal}:${row.subject_key}`} row={row} title={SIGNAL_INFO[row.signal].title} />
              ))}
            </section>
          );
        })
      )}

      {dismissed.length > 0 && (
        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer text-sm font-extrabold text-text-muted">
            Dismissed ({dismissed.length}) — they come back if they grow
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {dismissed.map((row) => (
              <Card key={row.dismissalId} className="flex items-center justify-between gap-4">
                <p className="min-w-0 text-sm font-bold text-text">
                  {SIGNAL_INFO[row.signal].title}: {row.subject_label}
                  <span className="ml-2 text-xs font-semibold text-text-muted">
                    {row.hits} (dismissed at {row.hitsAtDismissal}){row.note ? ` — ${row.note}` : ""}
                  </span>
                </p>
                <form action={undoDismissalAction}>
                  <input type="hidden" name="dismissalId" value={row.dismissalId} />
                  <button type="submit" className="shrink-0 text-xs font-extrabold text-primary">
                    Undo
                  </button>
                </form>
              </Card>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function WatchlistEntry({ row, title }: { row: WatchlistRow; title: string }) {
  const vendorIds = row.vendor_ids ?? [];
  // Hiding makes sense where the listings *are* the problem; for team seats,
  // claims and invites the listings may belong to other people.
  const canHide = (row.signal === "listing_burst" || row.signal === "shared_contact") && vendorIds.length > 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-text">
            {row.subject_label}
            <span className="ml-2 rounded-pill bg-secondary-soft px-2 py-0.5 text-[11px] font-extrabold text-ink">{row.hits}</span>
          </p>
          {row.detail && <p className="mt-1 text-xs font-semibold text-text-muted">{row.detail}</p>}
        </div>
        {row.subject_id && (
          <Link href={`/admin/planners/${row.subject_id}#moderation`} className="shrink-0 text-xs font-extrabold text-primary">
            Review / suspend user
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canHide && (
          <form action={hideVendorsAction}>
            <input type="hidden" name="vendorIds" value={vendorIds.join(",")} />
            <input type="hidden" name="reason" value={`Watchlist: ${title}`} />
            <Button type="submit" variant="secondary">
              Hide {vendorIds.length === 1 ? "this listing" : `these ${vendorIds.length} listings`}
            </Button>
          </form>
        )}
        <form action={dismissWatchlistEntryAction} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="signal" value={row.signal} />
          <input type="hidden" name="subjectKey" value={row.subject_key} />
          <input type="hidden" name="hits" value={row.hits} />
          <Input name="note" placeholder="Why it's fine (optional)" className="min-w-40 flex-1" />
          <Button type="submit" variant="secondary">
            Dismiss
          </Button>
        </form>
      </div>
    </Card>
  );
}
