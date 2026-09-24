"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_MOOD_BOARD_COLORS, MAX_MOOD_BOARD_PHOTOS } from "@/lib/mood-board-limits";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/image-upload-limits";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// event_mood_boards has at most one row per event, created lazily — every
// mutation here upserts on the table's own unique(event_id) constraint
// rather than assuming a row already exists. Palette/tags are plain jsonb
// string arrays (no per-item table), so add/remove/toggle is a real
// read-modify-write, not an atomic array op — acceptable here the same way
// budget_items.committed_amount already accepts that tradeoff: this is
// cosmetic board content, not money or availability.

async function getOrCreateBoardId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<{ id: string; palette: string[]; tags: string[] } | null> {
  const { data: existing } = await supabase
    .from("event_mood_boards")
    .select("id, palette, tags")
    .eq("event_id", eventId)
    .maybeSingle<{ id: string; palette: string[]; tags: string[] }>();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("event_mood_boards")
    .insert({ event_id: eventId })
    .select("id, palette, tags")
    .single<{ id: string; palette: string[]; tags: string[] }>();
  if (created) return created;

  // 23505 = unique_violation — a concurrent call (a double-tap, two tabs)
  // already created this event's row between the select above and this
  // insert. That's not a real failure, just a lost race: re-select instead
  // of surfacing an error for a save that, from the planner's side, worked.
  if (error?.code === "23505") {
    const { data: raceWinner } = await supabase
      .from("event_mood_boards")
      .select("id, palette, tags")
      .eq("event_id", eventId)
      .maybeSingle<{ id: string; palette: string[]; tags: string[] }>();
    return raceWinner ?? null;
  }

  return null;
}

// Read-only sibling of getOrCreateBoardId, for mutations that only need to
// act on a board that's already known to exist (there's nothing to create
// or add to if there's no board yet) — previously removeMoodBoardColor
// re-implemented this same select inline, which meant its return shape
// (missing `tags`) could silently drift from getOrCreateBoardId's.
async function getBoardId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<{ id: string; palette: string[]; tags: string[] } | null> {
  const { data } = await supabase
    .from("event_mood_boards")
    .select("id, palette, tags")
    .eq("event_id", eventId)
    .maybeSingle<{ id: string; palette: string[]; tags: string[] }>();
  return data ?? null;
}

const taglineSchema = z.object({
  eventId: z.string().uuid(),
  tagline: z.string().trim().max(120, "Keep it under 120 characters").optional().or(z.literal("")),
});

export interface MoodBoardTaglineState {
  error?: string;
}

export async function saveMoodBoardTagline(
  _prevState: MoodBoardTaglineState,
  formData: FormData,
): Promise<MoodBoardTaglineState> {
  const parsed = taglineSchema.safeParse({
    eventId: formData.get("eventId"),
    tagline: formData.get("tagline"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const { eventId, tagline } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_mood_boards")
    .upsert({ event_id: eventId, tagline: tagline || null, updated_at: new Date().toISOString() }, { onConflict: "event_id" });
  if (error) {
    return { error: "Something went wrong saving that. Please try again." };
  }

  revalidatePath(`/events/${eventId}/mood-board`);
  revalidatePath(`/events/${eventId}`);
  return {};
}

export interface MoodBoardColorState {
  error?: string;
}

export async function addMoodBoardColor(_prevState: MoodBoardColorState, formData: FormData): Promise<MoodBoardColorState> {
  const eventId = formData.get("eventId");
  const color = formData.get("color");
  if (typeof eventId !== "string" || !z.string().uuid().safeParse(eventId).success) {
    return { error: "Something went wrong. Please try again." };
  }
  if (typeof color !== "string" || !HEX_COLOR.test(color)) {
    return { error: "Please pick a color." };
  }

  const supabase = await createClient();
  const board = await getOrCreateBoardId(supabase, eventId);
  if (!board) {
    return { error: "Something went wrong. Please try again." };
  }
  if (board.palette.includes(color)) {
    return {};
  }
  if (board.palette.length >= MAX_MOOD_BOARD_COLORS) {
    return { error: `You can add up to ${MAX_MOOD_BOARD_COLORS} colors — remove one to add another.` };
  }

  const { error } = await supabase
    .from("event_mood_boards")
    .update({ palette: [...board.palette, color], updated_at: new Date().toISOString() })
    .eq("id", board.id);
  if (error) {
    return { error: "Something went wrong saving that color. Please try again." };
  }

  revalidatePath(`/events/${eventId}/mood-board`);
  revalidatePath(`/events/${eventId}`);
  return {};
}

// Tapping an existing swatch edits it in place rather than removing it —
// same picker as adding a new one, pre-filled with the current value, just
// replacing that one entry instead of appending. Falls back to a plain
// removal if the newly-picked color collides with one already on the
// palette, rather than allowing a duplicate.
export async function updateMoodBoardColor(_prevState: MoodBoardColorState, formData: FormData): Promise<MoodBoardColorState> {
  const eventId = formData.get("eventId");
  const oldColor = formData.get("oldColor");
  const newColor = formData.get("newColor");
  if (typeof eventId !== "string" || !z.string().uuid().safeParse(eventId).success) {
    return { error: "Something went wrong. Please try again." };
  }
  if (typeof oldColor !== "string" || typeof newColor !== "string" || !HEX_COLOR.test(newColor)) {
    return { error: "Please pick a color." };
  }
  if (oldColor === newColor) {
    return {};
  }

  const supabase = await createClient();
  const board = await getOrCreateBoardId(supabase, eventId);
  if (!board) {
    return { error: "Something went wrong. Please try again." };
  }
  if (!board.palette.includes(oldColor)) {
    return {};
  }

  const nextPalette = board.palette.includes(newColor)
    ? board.palette.filter((c) => c !== oldColor)
    : board.palette.map((c) => (c === oldColor ? newColor : c));

  const { error } = await supabase
    .from("event_mood_boards")
    .update({ palette: nextPalette, updated_at: new Date().toISOString() })
    .eq("id", board.id);
  if (error) {
    return { error: "Something went wrong saving that color. Please try again." };
  }

  revalidatePath(`/events/${eventId}/mood-board`);
  revalidatePath(`/events/${eventId}`);
  return {};
}

export async function removeMoodBoardColor(formData: FormData): Promise<void> {
  const eventId = formData.get("eventId");
  const color = formData.get("color");
  if (typeof eventId !== "string" || typeof color !== "string") return;

  const supabase = await createClient();
  const board = await getBoardId(supabase, eventId);
  if (!board) return;

  await supabase
    .from("event_mood_boards")
    .update({ palette: board.palette.filter((c) => c !== color), updated_at: new Date().toISOString() })
    .eq("id", board.id);

  revalidatePath(`/events/${eventId}/mood-board`);
  revalidatePath(`/events/${eventId}`);
}

export async function toggleMoodBoardTag(formData: FormData): Promise<void> {
  const eventId = formData.get("eventId");
  const tag = formData.get("tag");
  if (typeof eventId !== "string" || typeof tag !== "string" || !tag.trim()) return;
  const normalized = tag.trim().toLowerCase().slice(0, 24);

  const supabase = await createClient();
  const board = await getOrCreateBoardId(supabase, eventId);
  if (!board) return;

  const nextTags = board.tags.includes(normalized)
    ? board.tags.filter((t) => t !== normalized)
    : [...board.tags, normalized].slice(0, 12);

  await supabase.from("event_mood_boards").update({ tags: nextTags, updated_at: new Date().toISOString() }).eq("id", board.id);

  revalidatePath(`/events/${eventId}/mood-board`);
  revalidatePath(`/events/${eventId}`);
}

export interface MoodBoardPhotoUploadState {
  error?: string;
}

export async function uploadMoodBoardPhoto(
  _prevState: MoodBoardPhotoUploadState,
  formData: FormData,
): Promise<MoodBoardPhotoUploadState> {
  const eventId = formData.get("eventId");
  const file = formData.get("file");

  if (typeof eventId !== "string" || !z.string().uuid().safeParse(eventId).success) {
    return { error: "Something went wrong. Please try again." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a photo to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Please upload a JPEG, PNG, or WebP image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "That image is too large — please keep it under 5MB." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — please log in again." };
  }

  const { count } = await supabase
    .from("event_mood_board_photos")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if ((count ?? 0) >= MAX_MOOD_BOARD_PHOTOS) {
    return { error: `Your mood board is at its ${MAX_MOOD_BOARD_PHOTOS}-photo limit. Remove one to add another.` };
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${eventId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("event-mood-board").upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) {
    return { error: "Couldn't upload that photo. Please try again." };
  }

  const { error: insertError } = await supabase.from("event_mood_board_photos").insert({
    event_id: eventId,
    storage_path: path,
    created_by: user.id,
  });
  if (insertError) {
    await supabase.storage.from("event-mood-board").remove([path]);
    return { error: "Something went wrong saving that photo. Please try again." };
  }

  revalidatePath(`/events/${eventId}/mood-board`);
  revalidatePath(`/events/${eventId}`);
  return {};
}

export async function removeMoodBoardPhoto(formData: FormData): Promise<void> {
  const photoId = formData.get("photoId");
  const eventId = formData.get("eventId");
  const storagePath = formData.get("storagePath");
  if (typeof photoId !== "string" || typeof eventId !== "string" || typeof storagePath !== "string") return;

  const supabase = await createClient();
  const { error } = await supabase.from("event_mood_board_photos").delete().eq("id", photoId);
  if (!error) {
    // Best-effort cleanup, same as every other photo-delete action in the
    // app (gallery, vendor gallery, chat, payment proofs) — the DB row is
    // already gone, so a failure here just orphans the file rather than
    // leaving anything inconsistent for the user. Logged (not previously)
    // so a transient failure is at least visible server-side instead of
    // silently swallowed.
    const { error: storageError } = await supabase.storage.from("event-mood-board").remove([storagePath]);
    if (storageError) {
      console.error("removeMoodBoardPhoto: failed to remove storage object", storagePath, storageError);
    }
  }

  revalidatePath(`/events/${eventId}/mood-board`);
  revalidatePath(`/events/${eventId}`);
}

// Featuring is the "fan" — the board's one consistent hero moment,
// deliberately capped at 2 regardless of how many photos exist. Toggling a
// 3rd photo on un-features whichever of the current two was featured
// longest ago (oldest featuredAt), a FIFO swap rather than rejecting the
// tap outright — matches how the round-four mockup described the fan as
// always exactly 2, never a size the planner has to manage by hand.
export async function toggleFeaturedPhoto(formData: FormData): Promise<void> {
  const photoId = formData.get("photoId");
  const eventId = formData.get("eventId");
  if (typeof photoId !== "string" || typeof eventId !== "string") return;

  const supabase = await createClient();

  // Both reads run together rather than sequentially — neither actually
  // depends on the other's result, only on which branch below runs once
  // both are back. That also shrinks (doesn't eliminate — see the comment
  // below) the window in which two concurrent toggles can race each other.
  const [{ data: photo }, { data: currentlyFeatured }] = await Promise.all([
    supabase.from("event_mood_board_photos").select("id, is_featured").eq("id", photoId).maybeSingle<{
      id: string;
      is_featured: boolean;
    }>(),
    supabase
      .from("event_mood_board_photos")
      .select("id, featured_at")
      .eq("event_id", eventId)
      .eq("is_featured", true)
      .order("featured_at", { ascending: true })
      .returns<{ id: string; featured_at: string | null }[]>(),
  ]);
  if (!photo) return;

  if (photo.is_featured) {
    await supabase.from("event_mood_board_photos").update({ is_featured: false, featured_at: null }).eq("id", photoId);
    revalidatePath(`/events/${eventId}/mood-board`);
    revalidatePath(`/events/${eventId}`);
    return;
  }

  // Trims to at most 1 already-featured photo before adding this one, not
  // just "unfeature one if there happen to be exactly 2" — the read above
  // isn't wrapped in a transaction with the writes below, so two feature
  // taps racing (a fast double-tap, or two collaborators tapping different
  // photos at once) can both read the same snapshot and both decide it's
  // safe to add theirs, briefly leaving 3+ rows flagged featured. Trimming
  // to 1 unconditionally means the very next toggle always self-heals back
  // down to the real 2-photo cap instead of the drift compounding — a
  // transaction/DB-level constraint would close the window entirely, which
  // wasn't taken on for what's a purely cosmetic, self-correcting fan cap.
  const excess = (currentlyFeatured ?? []).slice(0, Math.max(0, (currentlyFeatured?.length ?? 0) - 1));

  // The unfeature-excess and feature-new writes touch disjoint rows (the
  // new photo is never itself in `excess`), so there's nothing ordering
  // one before the other — running them together halves the remaining
  // write-side latency on top of the parallel reads above.
  await Promise.all([
    excess.length > 0
      ? supabase
          .from("event_mood_board_photos")
          .update({ is_featured: false, featured_at: null })
          .in(
            "id",
            excess.map((p) => p.id),
          )
      : Promise.resolve(),
    supabase
      .from("event_mood_board_photos")
      .update({ is_featured: true, featured_at: new Date().toISOString() })
      .eq("id", photoId),
  ]);

  revalidatePath(`/events/${eventId}/mood-board`);
  revalidatePath(`/events/${eventId}`);
}
