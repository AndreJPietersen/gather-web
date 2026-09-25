import { MessageCircle } from "lucide-react";
import { cn } from "@gather/shared/utils";

// Colocated with the rest of the chat feature's shared pieces
// (chat-thread.tsx, actions.ts), cross-imported into the vendor dashboard
// the same way ChatThread/getRecentChatMessages already are. No numeric
// count-badge precedent exists anywhere else in this app — every existing
// pill (status labels, the "Tasks"/"Payment" icon+word pills on the
// events list) is a passive label. This one needs to read as "something
// needs your attention," so it deliberately breaks from the soft-tint
// convention every other pill uses — solid bg-primary/text-white, the
// same deliberate departure the page-level "Over budget" banner already
// makes for the same reason.
const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};
const ICON_SIZE = { sm: 11, md: 14 };

export function ChatUnreadBadge({ count, size = "sm" }: { count: number; size?: "sm" | "md" }) {
  return (
    <span className={cn("flex items-center gap-1 rounded-pill bg-primary font-extrabold text-white", SIZE_CLASSES[size])}>
      <MessageCircle size={ICON_SIZE[size]} strokeWidth={2.5} />
      {count}
    </span>
  );
}
