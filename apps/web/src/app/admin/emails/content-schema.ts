import { z } from "zod";
import type { EmailTemplateContent } from "@gather/shared/email/layout";

// Parses the template-content fields both the template editor and the send
// page post. Kept out of actions.ts because a "use server" module may only
// export async functions.

const text = (max: number) => z.string().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const contentSchema = z.object({
  category: z.enum(["transactional", "announcement"]),
  subject: z.string().trim().min(1, "Add a subject line.").max(200),
  preheader: text(200),
  heading: text(200),
  body: text(20000),
  buttonLabel: text(80),
  buttonUrl: text(500),
  useRawHtml: z.string().optional().transform((v) => v === "true"),
  rawHtml: text(100000),
});

export function contentFromForm(formData: FormData): { content?: EmailTemplateContent; error?: string } {
  const parsed = contentSchema.safeParse({
    category: formData.get("category"),
    subject: formData.get("subject") ?? "",
    preheader: formData.get("preheader") ?? "",
    heading: formData.get("heading") ?? "",
    body: formData.get("body") ?? "",
    buttonLabel: formData.get("buttonLabel") ?? "",
    buttonUrl: formData.get("buttonUrl") ?? "",
    useRawHtml: formData.get("useRawHtml") ?? "false",
    rawHtml: formData.get("rawHtml") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the email." };
  return { content: parsed.data };
}

export type Audience =
  | { type: "user"; userId: string }
  | { type: "segment"; segment: "everyone" | "planners" | "vendor_owners" | "vendor_team" | "new_users"; vendorId?: string; days?: number }
  | { type: "addresses"; emails: string[] };

const emailList = z.array(z.string().trim().toLowerCase().email());

export function audienceFromForm(formData: FormData): { audience?: Audience; error?: string } {
  const type = formData.get("audienceType");
  if (type === "user") {
    const userId = z.string().uuid().safeParse(formData.get("userId"));
    return userId.success ? { audience: { type: "user", userId: userId.data } } : { error: "Choose who to email." };
  }
  if (type === "segment") {
    const segment = z.enum(["everyone", "planners", "vendor_owners", "vendor_team", "new_users"]).safeParse(formData.get("segment"));
    if (!segment.success) return { error: "Choose a group." };
    if (segment.data === "vendor_team") {
      const vendorId = z.string().uuid().safeParse(formData.get("vendorId"));
      if (!vendorId.success) return { error: "Choose a business." };
      return { audience: { type: "segment", segment: segment.data, vendorId: vendorId.data } };
    }
    if (segment.data === "new_users") {
      const days = z.coerce.number().int().min(1).max(3650).safeParse(formData.get("days"));
      if (!days.success) return { error: "Enter how many days back." };
      return { audience: { type: "segment", segment: segment.data, days: days.data } };
    }
    return { audience: { type: "segment", segment: segment.data } };
  }
  if (type === "addresses") {
    const raw = String(formData.get("addresses") ?? "")
      .split(/[\s,;]+/)
      .filter(Boolean);
    const parsed = emailList.safeParse(raw);
    if (!parsed.success || raw.length === 0) {
      const bad = raw.find((e) => !z.string().email().safeParse(e.trim()).success);
      return { error: bad ? `"${bad}" isn't a valid email address.` : "Add at least one email address." };
    }
    return { audience: { type: "addresses", emails: Array.from(new Set(parsed.data)) } };
  }
  return { error: "Choose who to send to." };
}

export function describeAudience(a: Audience): string {
  if (a.type === "user") return "One person";
  if (a.type === "addresses") return `${a.emails.length} typed address${a.emails.length === 1 ? "" : "es"}`;
  switch (a.segment) {
    case "everyone":
      return "Everyone";
    case "planners":
      return "All planners";
    case "vendor_owners":
      return "All vendor owners";
    case "vendor_team":
      return "A business's team";
    case "new_users":
      return `People who joined in the last ${a.days} days`;
  }
}
