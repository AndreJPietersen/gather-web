import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { formatEventDate, formatZAR } from "@/lib/utils";
import { sastDayKey } from "@/lib/vendor-ranking";
import {
  PLACEMENT_STATE_CLASSES,
  PLACEMENT_STATE_LABELS,
  describePosition,
  getPlacementState,
  type PlacementState,
  type PlacementStatus,
} from "@/lib/feature-placements";
import { setPlacementStatus } from "./actions";

interface PlacementRow {
  id: string;
  vendor_id: string;
  status: PlacementStatus;
  starts_on: string;
  ends_on: string;
  position: number | null;
  fee_amount: string | null;
  note: string | null;
  vendors: { name: string } | null;
}

const SECTION_ORDER: PlacementState[] = ["live", "scheduled", "pending", "ended", "cancelled"];

// The admin's view of paid featured placements. Live/scheduled/ended are
// derived from the dates here rather than stored (see
// src/lib/feature-placements.ts), so this page is always current without
// anything having to run at midnight.
export default async function AdminFeaturedPage() {
  await requireAdmin();
  const service = createServiceClient();
  const today = sastDayKey();

  const { data } = await service
    .from("vendor_feature_placements")
    .select("id, vendor_id, status, starts_on, ends_on, position, fee_amount, note, vendors(name)")
    .order("starts_on", { ascending: false })
    .returns<PlacementRow[]>();

  const placements = (data ?? []).map((p) => ({ ...p, state: getPlacementState(p, today) }));
  const live = placements.filter((p) => p.state === "live");
  const pinned = live.filter((p) => p.position !== null).sort((a, b) => a.position! - b.position!);
  const rotating = live.filter((p) => p.position === null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Featured vendors</h1>
        <LinkButton href="/admin/featured/new" variant="accent">
          New placement
        </LinkButton>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold text-ink">Order on the site right now</h2>
        {live.length === 0 ? (
          <p className="text-sm font-semibold text-text-muted">No vendor is featured today.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm font-bold text-text">
            {pinned.map((p) => (
              <li key={p.id}>
                <span className="mr-2 inline-block w-8 text-primary">{describePosition(p.position)}</span>
                {p.vendors?.name}
              </li>
            ))}
            {rotating.length > 0 && (
              <li>
                <span className="mr-2 inline-block w-8 text-primary">…</span>
                Rotating pool ({rotating.length}): {rotating.map((p) => p.vendors?.name).join(", ")}
                <span className="block pl-10 text-xs font-semibold text-text-muted">
                  Shown after the pinned vendors, in an order that reshuffles each day.
                </span>
              </li>
            )}
          </ol>
        )}
      </Card>

      {SECTION_ORDER.map((state) => {
        const rows = placements.filter((p) => p.state === state);
        if (rows.length === 0) return null;
        return (
          <section key={state} className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">
              {PLACEMENT_STATE_LABELS[state]} ({rows.length})
            </h2>
            {rows.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-bold text-text">
                    {p.vendors?.name ?? "Unknown vendor"}
                    <span className={`ml-2 rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${PLACEMENT_STATE_CLASSES[p.state]}`}>
                      {PLACEMENT_STATE_LABELS[p.state]}
                    </span>
                    <span className="ml-2 rounded-pill bg-bg px-2 py-0.5 text-[10px] font-extrabold uppercase text-text-muted">
                      {describePosition(p.position)}
                    </span>
                  </p>
                  <p className="text-xs font-semibold text-text-muted">
                    {formatEventDate(p.starts_on)} – {formatEventDate(p.ends_on)}
                    {p.fee_amount !== null && ` · ${formatZAR(p.fee_amount)}`}
                  </p>
                  {p.note && <p className="text-xs font-semibold text-text-muted">{p.note}</p>}
                </div>
                <div className="flex gap-2">
                  {p.status === "pending" && (
                    <form action={setPlacementStatus}>
                      <input type="hidden" name="placementId" value={p.id} />
                      <input type="hidden" name="status" value="activated" />
                      <Button type="submit" variant="accent" className="px-4 py-2 text-xs">
                        Activate
                      </Button>
                    </form>
                  )}
                  {p.status !== "cancelled" ? (
                    <form action={setPlacementStatus}>
                      <input type="hidden" name="placementId" value={p.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <Button type="submit" variant="secondary" className="px-4 py-2 text-xs">
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <form action={setPlacementStatus}>
                      <input type="hidden" name="placementId" value={p.id} />
                      <input type="hidden" name="status" value="pending" />
                      <Button type="submit" variant="secondary" className="px-4 py-2 text-xs">
                        Reopen
                      </Button>
                    </form>
                  )}
                  <LinkButton href={`/admin/featured/${p.id}`} variant="secondary" className="px-4 py-2 text-xs">
                    Edit
                  </LinkButton>
                </div>
              </Card>
            ))}
          </section>
        );
      })}

      {placements.length === 0 && (
        <Card>
          <p className="text-sm font-semibold text-text-muted">
            No placements yet. Create one to feature a vendor for a date range — pinned to a position, or in the
            rotating pool.
          </p>
        </Card>
      )}
    </div>
  );
}
