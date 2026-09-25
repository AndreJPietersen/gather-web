import { z } from "zod";

// Deliberately NOT in actions.ts: a "use server" file may only export
// async functions (a hard Next.js constraint — a zod schema export throws
// "A 'use server' file can only export async functions, found object" at
// runtime), so the schema shared with help-me-plan/actions.ts's wizard
// duplicate lives in its own plain module instead.
export const attendeeSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("That doesn't look like a valid email").max(200).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(0).max(20),
});
