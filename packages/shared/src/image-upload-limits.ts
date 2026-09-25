// Shared by every Server Action that accepts a user-uploaded image
// (mood board photos, event/vendor gallery photos, chat attachments,
// support-case attachments) — previously the same two constants, byte for
// byte, independently declared in five different actions.ts files. Change
// the app-wide image size cap or allowed MIME types here once, not five
// times.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
