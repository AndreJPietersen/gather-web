import Link from "next/link";

interface PreviewPhoto {
  id: string;
  url: string;
}

// The "live preview strip" entry point (Option 3 from the mockup round) —
// deliberately not a static icon+label like Help Me Plan's card: the point
// is that this card itself is a tiny version of the board, so it earns a
// glance the way a real mood board thumbnail would rather than reading as
// just another link. Three icon-area states: the featured-photo fan (real
// content to show), a plain photo icon (real photos exist, just none
// starred yet — still not "empty"), and the palette icon (genuinely
// nothing added). hasAnyPhoto is a real, separate count from the server —
// featuredPhotos alone can't tell "no photos" apart from "photos, none
// featured," which previously made an uploaded-but-unstarred board render
// as if it were empty.
export function MoodBoardPreviewCard({
  eventId,
  tagline,
  palette,
  featuredPhotos,
  hasAnyPhoto,
}: {
  eventId: string;
  tagline: string | null;
  palette: string[];
  featuredPhotos: PreviewPhoto[];
  hasAnyPhoto: boolean;
}) {
  const isEmpty = !hasAnyPhoto && palette.length === 0 && !tagline;

  return (
    <Link
      href={`/events/${eventId}/mood-board`}
      className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3"
    >
      {featuredPhotos.length > 0 ? (
        <div className="relative h-10 w-[62px] shrink-0">
          {featuredPhotos.map((photo, index) => (
            <div
              key={photo.id}
              className="absolute h-[30px] w-[30px] rounded-[2px] bg-white p-[2px] pb-[6px] shadow-[0_2px_5px_-2px_rgba(0,0,0,0.3)]"
              style={{
                top: index === 0 ? 0 : 4,
                left: index === 0 ? 0 : 20,
                transform: `rotate(${index === 0 ? -5 : 4}deg)`,
                zIndex: index + 1,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
              <img src={photo.url} alt="" className="h-full w-full rounded-[1px] object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-base">
          {isEmpty ? "🎨" : "🖼️"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-ink">Mood Board</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-text-muted">
          {isEmpty ? "Colors, photos and a vibe — make it yours." : (tagline ?? "Tap to see your board")}
        </p>
      </div>
      {palette.length > 0 && (
        <div className="flex shrink-0 gap-1">
          {palette.slice(0, 3).map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          ))}
        </div>
      )}
    </Link>
  );
}
