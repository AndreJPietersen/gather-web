import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../access";
import { MAX_MOOD_BOARD_PHOTOS, MOOD_BOARD_TAG_PRESETS } from "@/lib/mood-board-limits";
import { TaglineForm } from "./tagline-form";
import { AddColorForm } from "./add-color-form";
import { PaletteSwatch } from "./palette-swatch";
import { AddMoodBoardPhotoForm } from "./add-mood-board-photo-form";
import { removeMoodBoardPhoto, toggleFeaturedPhoto, toggleMoodBoardTag } from "./actions";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface BoardRow {
  tagline: string | null;
  palette: string[];
  tags: string[];
}

interface PhotoRow {
  id: string;
  storage_path: string;
  is_featured: boolean;
  featured_at: string | null;
}

// A pinch of intentional per-photo variety (rotation, whether it overlaps
// its featured partner) generated from the photo's own id rather than
// stored or randomized on every render — the round-two mockup's own
// callout for the scrapbook direction ("tilts are generated automatically,
// seeded by id, so it doesn't jump around on reload").
function angleFromId(id: string, spread: number): number {
  const n = parseInt(id.replace(/-/g, "").slice(0, 6), 16);
  return ((n % 100) / 100) * spread * 2 - spread;
}

export default async function EventMoodBoardPage({ params }: PageProps<"/events/[id]/mood-board">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, owner_id, name").eq("id", id).maybeSingle();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  if (!access.isOwner && !access.isCollaborator) {
    notFound();
  }

  const [{ data: board }, { data: photos }] = await Promise.all([
    supabase.from("event_mood_boards").select("tagline, palette, tags").eq("event_id", event.id).maybeSingle<BoardRow>(),
    supabase
      .from("event_mood_board_photos")
      .select("id, storage_path, is_featured, featured_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
      .returns<PhotoRow[]>(),
  ]);

  const allPhotos = photos ?? [];
  // One batched request for all of this board's photos (up to
  // MAX_MOOD_BOARD_PHOTOS) instead of one Storage round trip per photo.
  const signedUrlByPath = new Map<string, string>();
  if (allPhotos.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("event-mood-board")
      .createSignedUrls(
        allPhotos.map((p) => p.storage_path),
        SIGNED_URL_TTL_SECONDS,
      );
    for (const entry of signedUrls ?? []) {
      if (entry.path && entry.signedUrl) signedUrlByPath.set(entry.path, entry.signedUrl);
    }
  }
  const photosWithUrls = allPhotos.map((photo) => ({ ...photo, url: signedUrlByPath.get(photo.storage_path) ?? null }));

  const featured = photosWithUrls
    .filter((p) => p.is_featured)
    .sort((a, b) => (b.featured_at ?? "").localeCompare(a.featured_at ?? ""))
    .slice(0, 2);
  const featuredIds = new Set(featured.map((p) => p.id));
  const rest = photosWithUrls.filter((p) => !featuredIds.has(p.id));

  const palette = board?.palette ?? [];
  const activeTags = new Set(board?.tags ?? []);
  const customTags = (board?.tags ?? []).filter((t) => !MOOD_BOARD_TAG_PRESETS.includes(t as (typeof MOOD_BOARD_TAG_PRESETS)[number]));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Mood Board">
        <p className="text-sm font-semibold text-text-muted">{event.name}</p>
      </PageHeader>

      {access.isEditor ? (
        <TaglineForm eventId={event.id} defaultValue={board?.tagline ?? null} />
      ) : (
        board?.tagline && (
          <div className="relative text-center">
            <span className="relative z-10 font-display text-lg font-semibold italic text-ink">{board.tagline}</span>
            <svg
              aria-hidden
              viewBox="0 0 200 15"
              className="pointer-events-none absolute left-1/2 top-[62%] h-[15px] w-[190px] -translate-x-1/2"
              preserveAspectRatio="none"
            >
              <path d="M4,9 C55,3 145,13 196,6" stroke="var(--color-secondary)" strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.9" />
            </svg>
          </div>
        )
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Palette</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {palette.map((color) =>
            access.isEditor ? (
              <PaletteSwatch key={color} eventId={event.id} color={color} />
            ) : (
              <span
                key={color}
                className="h-9 w-9 rounded-[50%_50%_50%_4px] border-2 border-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
                style={{ backgroundColor: color }}
              />
            ),
          )}
          {access.isEditor && <AddColorForm eventId={event.id} />}
          {palette.length === 0 && !access.isEditor && <p className="text-sm font-semibold text-text-muted">No colors yet.</p>}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Photos</h2>
        {featured.length > 0 && (
          // The first featured photo stays in normal flow so this
          // container's real height always comes from its actual content
          // (a real photo's rendered height, not a guessed pixel number) —
          // a fixed height here previously caused the card to overflow
          // into the grid below and, since it carried an explicit z-index,
          // visually cover that grid photo's own buttons. Only the second
          // (if any) is absolutely positioned, offset relative to the
          // first rather than the container.
          <div className="relative mt-3">
            {featured.map((photo, index) => (
              <div
                key={photo.id}
                className={`${index === 0 ? "relative" : "absolute left-[42%] top-[10px]"} w-[56%] rounded-[3px] bg-white p-[3px] pb-[9px] shadow-[0_4px_8px_-3px_rgba(0,0,0,0.22)]`}
                style={{ transform: `rotate(${angleFromId(photo.id, 4)}deg)`, zIndex: index + 1 }}
              >
                {photo.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static/optimizable asset
                  <img src={photo.url} alt="" className="aspect-[1.2] w-full rounded-[1px] object-cover" />
                )}
                {access.isEditor && (
                  <div className="absolute -right-1 -top-1 flex gap-1">
                    <form action={toggleFeaturedPhoto}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="photoId" value={photo.id} />
                      <button type="submit" aria-label="Unfeature this photo" className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow">
                        ⭐
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
          {rest.map((photo) => (
            <div
              key={photo.id}
              className="relative w-[31%] rounded-[3px] bg-white p-[3px] pb-[9px] shadow-[0_4px_8px_-3px_rgba(0,0,0,0.22)]"
              style={{ transform: `rotate(${angleFromId(photo.id, 2)}deg)` }}
            >
              {photo.url && (
                // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static/optimizable asset
                <img src={photo.url} alt="" className="aspect-square w-full rounded-[1px] object-cover" />
              )}
              {access.isEditor && (
                <div className="absolute -right-1 -top-1 flex gap-1">
                  <form action={toggleFeaturedPhoto}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <button type="submit" aria-label="Feature this photo" className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[10px] shadow">
                      ☆
                    </button>
                  </form>
                  <form action={removeMoodBoardPhoto}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <input type="hidden" name="storagePath" value={photo.storage_path} />
                    <button type="submit" aria-label="Remove this photo" className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-[10px] text-white shadow">
                      ✕
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>

        {allPhotos.length === 0 && !access.isEditor && (
          <Card className="mt-3">
            <p className="text-sm font-semibold text-text-muted">No photos yet.</p>
          </Card>
        )}

        {access.isEditor &&
          (allPhotos.length >= MAX_MOOD_BOARD_PHOTOS ? (
            <p className="mt-3 text-xs font-semibold text-text-muted">
              Your board is at its {MAX_MOOD_BOARD_PHOTOS}-photo limit. Remove one to add another.
            </p>
          ) : (
            <div className="mt-3">
              <AddMoodBoardPhotoForm eventId={event.id} isEmpty={allPhotos.length === 0} />
            </div>
          ))}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Vibe</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...MOOD_BOARD_TAG_PRESETS, ...customTags].map((tag) => {
            const isActive = activeTags.has(tag);
            const pillClass = `rounded-pill px-3 py-1.5 text-xs font-bold ${isActive ? "bg-primary-soft text-primary" : "bg-surface-2 text-text-muted border border-border"}`;
            if (!access.isEditor) {
              return isActive ? (
                <span key={tag} className={pillClass}>
                  {tag}
                </span>
              ) : null;
            }
            return (
              <form key={tag} action={toggleMoodBoardTag}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="tag" value={tag} />
                <button type="submit" className={pillClass}>
                  {tag}
                </button>
              </form>
            );
          })}
        </div>
        {access.isEditor && (
          <form action={toggleMoodBoardTag} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="eventId" value={event.id} />
            <input
              type="text"
              name="tag"
              placeholder="Add your own…"
              maxLength={24}
              className="w-full min-w-0 rounded-field border-2 border-border bg-surface px-[13px] py-[9px] text-xs font-bold text-text placeholder:font-semibold placeholder:text-text-muted"
            />
            <button type="submit" className="shrink-0 text-xs font-extrabold text-primary">
              Add
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
