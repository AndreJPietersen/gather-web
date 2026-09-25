import { z } from "zod";

// Deliberately NOT in actions.ts: a "use server" file may only export
// async functions (a hard Next.js constraint — a zod schema export throws
// "A 'use server' file can only export async functions, found object" at
// runtime), so the schema shared with help-me-plan/actions.ts's wizard
// duplicate lives in its own plain module instead.
export const associateWithEventSchema = z.object({
  vendorId: z.string().uuid(),
  eventId: z.string().uuid(),
});
