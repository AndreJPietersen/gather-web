"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  sendChatMessage,
  getSignedChatImageUrl,
  getRecentChatMessages,
  markChatThreadRead,
  type ChatMessage,
  type SendChatMessageState,
} from "./actions";

interface Participant {
  id: string;
  name: string;
}

interface ChatRow {
  id: string;
  sender_id: string;
  body: string | null;
  storage_path: string | null;
  created_at: string;
}

const initialState: SendChatMessageState = {};

// A pure function, not a ref-backed Set — this project's lint config
// (react-hooks/refs) forbids touching a ref's .current during render, and
// this dedupe needs to run both during render (the sender's own send,
// below) and from the Realtime subscription's callback. Checking against
// the messages array itself (real React state, safe to read anywhere) is
// O(n) per insert, fine at the size a single chat thread ever reaches.
function appendIfNew(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (messages.some((m) => m.id === message.id)) return messages;
  return [...messages, message];
}

// Unlike appendIfNew (used where a message is either genuinely new or
// already correct, and skipping a duplicate is all that's needed),
// `fetched` here is always the server's authoritative, freshly-resolved
// copy — including a freshly-signed image URL. It must overwrite any
// matching id already held locally, not just skip it: the Realtime handler
// below can add a message with imageUrl null when signing it failed at
// delivery time (a transient storage/network hiccup, not something to
// retry inline), and this poll is what's supposed to heal that within 5s.
// A plain "add if missing" merge would leave that message permanently
// blank for the rest of the session instead.
function mergeReconciled(prev: ChatMessage[], fetched: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const message of fetched) {
    byId.set(message.id, message);
  }
  // A message the warm-up race dropped, caught by reconciliation after a
  // newer message already arrived live, needs re-sorting back into its
  // real chronological spot.
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Shared by both the event-side and vendor-side chat pages — everything
// about "who can see/send this thread" already happened server-side before
// this ever mounts (RLS, plus each page's own getEventAccess/getVendorAccess
// gate), so this component only ever renders for someone already allowed
// to be here. canSend is a separate, narrower gate for whether *this*
// viewer may currently send — a read-only event collaborator (viewer
// permission) on the event side, or an unverified vendor's team on the
// vendor side (event_vendor_messages' own INSERT policy actually enforces
// both; this just keeps the composer from ever presenting a control that
// would only fail silently against RLS). When false and no lockedMessage
// is given, the composer is simply omitted — the same silent-omission
// convention every other viewer-gated add-form in this app already uses
// (e.g. AddBudgetItemForm only rendering for access.isEditor).
export function ChatThread({
  eventVendorId,
  currentUserId,
  participants,
  initialMessages,
  canSend,
  lockedMessage,
}: {
  eventVendorId: string;
  currentUserId: string;
  participants: Participant[];
  initialMessages: ChatMessage[];
  canSend: boolean;
  lockedMessage?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [state, formAction, pending] = useActionState(sendChatMessage, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  // Tracks which state.message this component has already folded into
  // `messages`, as STATE (not a ref) so it's safe to read/write during
  // render — this project's lint (react-hooks/refs) forbids ref access
  // during render entirely.
  const [lastHandledMessageId, setLastHandledMessageId] = useState<string | null>(null);

  // The Server Action already returns the fully-resolved message (signed
  // URL included), so the sender sees their own send immediately — no
  // waiting on, or dedupe race against, the Realtime echo below. Handled
  // during render (react.dev's "adjusting state when a prop changes"
  // pattern), not in a useEffect — an effect that calls setState
  // synchronously in its own body trips this project's
  // react-hooks/set-state-in-effect lint rule, since it's just an extra
  // render pass for something React can already apply in the same pass
  // that produced the new state. The lastHandledMessageId guard is what
  // keeps this from looping: once handled, the condition is false again
  // until a genuinely new state.message arrives.
  if (state.message && state.message.id !== lastHandledMessageId) {
    setLastHandledMessageId(state.message.id);
    setMessages((prev) => appendIfNew(prev, state.message!));
    setSelectedFileName(null);
  }

  // The DOM-only part of the same "on successful send" reaction — resetting
  // an uncontrolled form's real input elements isn't a state update, so it
  // stays a real effect (imperative DOM work belongs in an effect, not
  // during render).
  useEffect(() => {
    if (state.message) {
      formRef.current?.reset();
    }
  }, [state.message]);

  // First Realtime subscription anywhere in this codebase — Postgres
  // Changes delivery is filtered server-side per this table's own RLS
  // SELECT policy, so no client-side access check is needed here either.
  //
  // There's a real warm-up race on top of that, confirmed by direct
  // testing against this local stack: an INSERT made shortly after a
  // channel reports SUBSCRIBED can be silently dropped — not just the very
  // first one; a message sent a second or more after SUBSCRIBED can still
  // be missed. A one-shot reconcile right at SUBSCRIBED (tried first) only
  // catches messages that already existed *before* subscribing finished —
  // it can't help with a message sent moments later that Realtime then
  // also fails to deliver live, since the one-shot fetch already ran and
  // found nothing. A short recurring poll for as long as the thread is
  // open is what actually closes this: confirmed by testing a message sent
  // immediately on page load (the worst case) — with only the one-shot
  // reconcile it never arrived without a manual reload; with this poll it
  // reliably surfaced on its own. 5s keeps the worst case low (a dropped
  // message still reads as "basically live," not stuck) without polling
  // aggressively; Realtime remains the live layer, this is what makes it
  // eventually-correct underneath instead of a single point of failure.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event-vendor-chat:${eventVendorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_vendor_messages",
          filter: `event_vendor_id=eq.${eventVendorId}`,
        },
        async (payload) => {
          const row = payload.new as ChatRow;
          // Caught, not left to reject: an image message's URL needs an
          // extra round trip a text message never does, so it's the one
          // path here that can actually fail (a transient storage/network
          // hiccup). An uncaught rejection here would abort this whole
          // callback before setMessages ever runs — the message would
          // never appear at all, not even as a broken image, until the
          // recipient reloaded the page. imageUrl staying null instead
          // still shows the message right away (as "Photo unavailable",
          // see the render below) and mergeReconciled heals it with a
          // freshly-signed URL on the next 5s poll.
          let imageUrl: string | null = null;
          if (row.storage_path) {
            try {
              imageUrl = await getSignedChatImageUrl(row.storage_path);
            } catch {
              imageUrl = null;
            }
          }
          const message: ChatMessage = {
            id: row.id,
            senderId: row.sender_id,
            body: row.body,
            hasImage: row.storage_path !== null,
            imageUrl,
            createdAt: row.created_at,
          };
          setMessages((prev) => appendIfNew(prev, message));
        },
      )
      .subscribe();

    function reconcile() {
      getRecentChatMessages(eventVendorId).then((fetched) => {
        setMessages((prev) => mergeReconciled(prev, fetched));
      });
      // Piggybacks on this same tick (mount, then every 5s) rather than a
      // separate timer — keeps the read marker advancing for as long as
      // the thread stays open, so a message that streams in live while
      // it's already being looked at doesn't linger as "unread" elsewhere
      // in the app just because no second visit ever re-marks it.
      markChatThreadRead(eventVendorId);
    }
    reconcile();
    const pollId = setInterval(reconcile, 5000);

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [eventVendorId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function senderName(senderId: string): string {
    if (senderId === currentUserId) return "You";
    return participants.find((p) => p.id === senderId)?.name ?? "Someone";
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-sm font-semibold text-text-muted">No messages yet — say hello.</p>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === currentUserId;
            return (
              <div key={message.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                {!isMine && <p className="px-1 text-[11px] font-extrabold text-text-muted">{senderName(message.senderId)}</p>}
                <div className={`max-w-[80%] rounded-[18px] px-3.5 py-2.5 ${isMine ? "bg-primary-soft" : "bg-surface"}`}>
                  {message.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL, not a static/optimizable asset
                    <img src={message.imageUrl} alt="Shared photo" className="mb-1 max-w-full rounded-[12px]" />
                  ) : (
                    // hasImage but no imageUrl means signing it failed (see
                    // the Realtime handler above) — shown instead of
                    // rendering nothing, so an image-only message never
                    // looks like a completely blank, invisible bubble. The
                    // next 5s reconcile poll replaces this with the real
                    // image once a fresh signed URL resolves.
                    message.hasImage && <p className="mb-1 text-xs font-semibold italic text-text-muted">Photo unavailable</p>
                  )}
                  {message.body && <p className={`text-sm font-semibold ${isMine ? "text-primary" : "text-text"}`}>{message.body}</p>}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="eventVendorId" value={eventVendorId} />
          <div className="flex items-center gap-2">
            <Input name="body" placeholder="Message" className="flex-1" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-field border-2 border-border bg-surface"
              aria-label="Attach a photo"
            >
              <ImagePlus size={20} strokeWidth={2} className="text-text-muted" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>
          {selectedFileName && (
            <p className="text-xs font-semibold text-text-muted">
              Attached: {selectedFileName}{" "}
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  setSelectedFileName(null);
                }}
                className="font-extrabold text-primary"
              >
                Remove
              </button>
            </p>
          )}
          {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </form>
      ) : (
        lockedMessage && (
          <Card>
            <p className="text-sm font-semibold text-text-muted">{lockedMessage}</p>
          </Card>
        )
      )}
    </div>
  );
}
