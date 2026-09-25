import { z } from "zod";

// Deliberately NOT in actions.ts: a "use server" file may only export
// async functions (a hard Next.js constraint — a zod schema export throws
// "A 'use server' file can only export async functions, found object" at
// runtime), so the schema shared with help-me-plan/actions.ts's wizard
// duplicate lives in its own plain module instead.
export const budgetItemSchema = z.object({
  eventId: z.string().uuid(),
  label: z.string().trim().min(2, "Label is too short").max(150),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  budgetedAmount: z.coerce.number().positive("Amount must be greater than zero"),
});
