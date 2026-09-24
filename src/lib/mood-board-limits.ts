// Deliberately smaller than MAX_GALLERY_IMAGES (20) — a mood board is meant
// to read as curated, not exhaustive, the same "keep it small enough to
// feel considered" reasoning the round-one mockup's own footer raised.
// Soft product cap, not a security invariant — same posture as
// MAX_GALLERY_IMAGES (see gallery-limits.ts), lives outside "use server"
// files for the same reason.
export const MAX_MOOD_BOARD_PHOTOS = 12;
export const MAX_MOOD_BOARD_COLORS = 8;

// Tap-to-toggle starting point on the vibe zone — the free-text tagline
// covers anything these don't. Not stored as an enum in the schema (tags
// is a plain jsonb string array) since this list is purely a UI
// convenience, not a data constraint the planner is limited to — the add-
// a-custom-tag input still takes anything.
export const MOOD_BOARD_TAG_PRESETS = ["romantic", "rustic", "garden", "modern", "boho", "classic", "glam"] as const;
