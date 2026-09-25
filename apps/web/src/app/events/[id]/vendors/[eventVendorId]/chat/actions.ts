"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MAX_CHAT_IMAGES } from "@/lib/chat-limits";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/image-upload-limits";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // matches the event-gallery page's own TTL

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string | null;
  // Distinct from `imageUrl` being non-null: a message can have an image
  // attached (hasImage: true) while its signed URL momentarily failed to
  // resolve (imageUrl: null) — ChatThread needs to tell that apart from
  // "no image was ever attached" to show a fallback instead of silently
  // rendering an empty, invisible bubble.
  hasImage: boolean;
  imageUrl: string | null;
  createdAt: string;
}

export interface SendChatMessageState {
  error?: string;
  message?: ChatMessage;
}

// Imported by both the event-side and vendor-side chat pages (the same
// cross-route-import precedent associateWithEvent already sets — see
// src/app/events/[id]/vendors/page.tsx importing from
// src/app/vendors/[id]/actions.ts). RLS
// (event_vendor_messages_insert_event_editor_or_vendor_member) is the real
// authorization here; everything below is format/limit validation, plus
// the storage upload the DB row alone can't do.
export async function sendChatMessage(
  _prevState: SendChatMessageState,
  formData: FormData,
): Promise<SendChatMessageState> {
  const eventVendorId = formData.get("eventVendorId");
  const bodyRaw = formData.get("body");
  const file = formData.get("image");

  if (typeof eventVendorId !== "string" || !z.string().uuid().safeParse(eventVendorId).success) {
    return { error: "Something went wrong. Please try again." };
  }

  const bodyParsed = z
    .string()
    .trim()
    .max(2000, "That message is too long — please keep it under 2000 characters.")
    .safeParse(typeof bodyRaw === "string" ? bodyRaw : "");
  if (!bodyParsed.success) {
    return { error: bodyParsed.error.issues[0]?.message ?? "Please check your message." };
  }
  const body = bodyParsed.data ? bodyParsed.data : null;
  const hasImage = file instanceof File && file.size > 0;

  if (!body && !hasImage) {
    return { error: "Write a message or attach a photo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — please log in again." };
  }

  let storagePath: string | null = null;
  if (hasImage) {
    const imageFile = file as File;
    if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
      return { error: "Please attach a JPEG, PNG, or WebP image." };
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { error: "That image is too large — please keep it under 5MB." };
    }

    // Same soft, race-tolerant count-then-check as the event gallery's own
    // MAX_GALLERY_IMAGES enforcement — a product/cost cap, not a security
    // invariant, so a plain SELECT count immediately before the check is
    // proportionate here too.
    const { count } = await supabase
      .from("event_vendor_messages")
      .select("id", { count: "exact", head: true })
      .eq("event_vendor_id", eventVendorId)
      .not("storage_path", "is", null);
    if ((count ?? 0) >= MAX_CHAT_IMAGES) {
      return { error: `This chat is at its ${MAX_CHAT_IMAGES}-photo limit.` };
    }

    const extension = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : "jpg";
    storagePath = `${eventVendorId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("event-vendor-chat").upload(storagePath, imageFile, {
      contentType: imageFile.type,
    });
    if (uploadError) {
      return { error: "Couldn't upload that photo. Please try again." };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("event_vendor_messages")
    .insert({
      event_vendor_id: eventVendorId,
      sender_id: user.id,
      body,
      storage_path: storagePath,
    })
    .select("id, sender_id, body, storage_path, created_at")
    .single<{ id: string; sender_id: string; body: string | null; storage_path: string | null; created_at: string }>();

  if (insertError || !inserted) {
    if (storagePath) {
      await supabase.storage.from("event-vendor-chat").remove([storagePath]);
    }
    return { error: "Something went wrong sending that message. Please try again." };
  }

  // Resolved here (not left for the client to fetch separately) so the
  // sender's own composer can show their message immediately on success,
  // without waiting on — or duplicating logic with — the Realtime echo.
  let imageUrl: string | null = null;
  if (inserted.storage_path) {
    const { data: signed } = await supabase.storage
      .from("event-vendor-chat")
      .createSignedUrl(inserted.storage_path, SIGNED_URL_TTL_SECONDS);
    imageUrl = signed?.signedUrl ?? null;
  }

  return {
    message: {
      id: inserted.id,
      senderId: inserted.sender_id,
      body: inserted.body,
      hasImage: inserted.storage_path !== null,
      imageUrl,
      createdAt: inserted.created_at,
    },
  };
}

// Called by the client thread when a Realtime-delivered INSERT payload
// carries an image (a raw storage_path, no signed URL — Realtime only ever
// sends the changed row, not a derived value like this). storage.objects
// RLS (event_vendor_chat_select_event_side_or_vendor_side) is what actually
// authorizes this; an unauthorized path just fails to sign, no separate
// manual check needed here.
export async function getSignedChatImageUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.storage.from("event-vendor-chat").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

interface ChatMessageRow {
  id: string;
  sender_id: string;
  body: string | null;
  storage_path: string | null;
  created_at: string;
}

// Shared by both chat pages' initial server-rendered fetch AND by
// ChatThread's own reconciliation call (it calls this directly, client
// components can call a Server Action like a plain async function) — one
// place for "fetch the last 100 messages, resolve signed URLs for any
// images" instead of the same block duplicated per page. RLS
// (event_vendor_messages_select_...) is what actually scopes this to
// threads the caller may see; a request from someone with no access to
// eventVendorId just comes back empty, same as any other RLS-protected
// select in this app.
//
// ChatThread calls this once every time its Realtime channel reports
// SUBSCRIBED (including reconnects after a network blip), specifically to
// close a real warm-up race confirmed by direct testing: an INSERT made
// shortly after a channel reports SUBSCRIBED on this local stack can be
// silently dropped (a raw subscribe-then-insert-immediately script missed
// the first event roughly as often as not; the same script with an 8s wait
// after SUBSCRIBED before inserting delivered 5/5 reliably). Realtime is a
// live nice-to-have layered on top of this fetch, the actual source of
// truth here, not the other way around.
export async function getRecentChatMessages(eventVendorId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("event_vendor_messages")
    .select("id, sender_id, body, storage_path, created_at")
    .eq("event_vendor_id", eventVendorId)
    .order("created_at", { ascending: true })
    .limit(100)
    .returns<ChatMessageRow[]>();

  return Promise.all(
    (messages ?? []).map(async (m) => {
      let imageUrl: string | null = null;
      if (m.storage_path) {
        const { data } = await supabase.storage.from("event-vendor-chat").createSignedUrl(m.storage_path, SIGNED_URL_TTL_SECONDS);
        imageUrl = data?.signedUrl ?? null;
      }
      return { id: m.id, senderId: m.sender_id, body: m.body, hasImage: m.storage_path !== null, imageUrl, createdAt: m.created_at };
    }),
  );
}

// Shared by both list pages that show a per-thread unread badge
// (events/[id]/vendors/page.tsx and vendor/[vendorId]/dashboard/page.tsx)
// — same "flat query plus in-app aggregation" shape the rest of this app's
// suggestion features already use, no RPC/view. RLS on event_vendor_messages
// already scopes the first query to threads the caller can see, so no
// extra access check is needed here beyond requiring a logged-in user.
export async function getUnreadCounts(eventVendorIds: string[]): Promise<Record<string, number>> {
  if (eventVendorIds.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const [{ data: messages }, { data: reads }] = await Promise.all([
    supabase
      .from("event_vendor_messages")
      .select("event_vendor_id, created_at")
      .in("event_vendor_id", eventVendorIds)
      .neq("sender_id", user.id)
      .returns<{ event_vendor_id: string; created_at: string }[]>(),
    supabase
      .from("event_vendor_chat_reads")
      .select("event_vendor_id, last_read_at")
      .eq("user_id", user.id)
      .in("event_vendor_id", eventVendorIds)
      .returns<{ event_vendor_id: string; last_read_at: string }[]>(),
  ]);

  const lastReadByThread = new Map((reads ?? []).map((r) => [r.event_vendor_id, r.last_read_at]));
  const unreadByThread: Record<string, number> = {};
  for (const m of messages ?? []) {
    const lastRead = lastReadByThread.get(m.event_vendor_id);
    if (!lastRead || m.created_at > lastRead) {
      unreadByThread[m.event_vendor_id] = (unreadByThread[m.event_vendor_id] ?? 0) + 1;
    }
  }
  return unreadByThread;
}

// Called by ChatThread on mount, and again every time its existing
// reconcile() tick fires (mount + the same 5s poll message-sync already
// uses) — so the read marker keeps advancing for as long as the thread
// stays open, covering a message that streams in live while it's already
// being looked at, without needing any new timer of its own. RLS
// (event_vendor_chat_reads_upsert_own) is what actually authorizes this;
// a request for a thread the caller can't see just fails the upsert.
export async function markChatThreadRead(eventVendorId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("event_vendor_chat_reads")
    .upsert(
      { event_vendor_id: eventVendorId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "event_vendor_id,user_id" },
    );
}
