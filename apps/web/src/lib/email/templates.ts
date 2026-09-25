import { createServiceClient } from "@/lib/supabase/service";
import { SYSTEM_TEMPLATE_DEFAULTS, type SystemTemplateKey } from "@gather/shared/email/fields";
import type { EmailCategory, EmailTemplateContent } from "@gather/shared/email/layout";

// Loading email_templates rows (service role — the table is admin-only).
// Callers must be admin code behind requireAdmin(), or the reminder sender,
// which only ever reads the fixed system templates.

export interface EmailTemplateRow {
  id: string;
  key: string | null;
  name: string;
  kind: "system" | "custom";
  category: EmailCategory;
  subject: string;
  preheader: string | null;
  heading: string | null;
  body: string | null;
  button_label: string | null;
  button_url: string | null;
  use_raw_html: boolean;
  raw_html: string | null;
  updated_at: string;
}

export const TEMPLATE_COLUMNS =
  "id, key, name, kind, category, subject, preheader, heading, body, button_label, button_url, use_raw_html, raw_html, updated_at";

export function rowToContent(row: EmailTemplateRow): EmailTemplateContent {
  return {
    category: row.category,
    subject: row.subject,
    preheader: row.preheader,
    heading: row.heading,
    body: row.body,
    buttonLabel: row.button_label,
    buttonUrl: row.button_url,
    useRawHtml: row.use_raw_html,
    rawHtml: row.raw_html,
  };
}

export async function listTemplates(): Promise<EmailTemplateRow[]> {
  const service = createServiceClient();
  const { data } = await service.from("email_templates").select(TEMPLATE_COLUMNS).order("kind").order("name");
  return (data ?? []) as EmailTemplateRow[];
}

export async function getTemplate(id: string): Promise<EmailTemplateRow | null> {
  const service = createServiceClient();
  const { data } = await service.from("email_templates").select(TEMPLATE_COLUMNS).eq("id", id).maybeSingle();
  return (data as EmailTemplateRow | null) ?? null;
}

// The automatic reminders' content: the admin-edited row if it exists,
// otherwise the built-in default — a missing row must never stop a reminder.
export async function getSystemTemplateContent(key: SystemTemplateKey): Promise<EmailTemplateContent> {
  const service = createServiceClient();
  const { data } = await service.from("email_templates").select(TEMPLATE_COLUMNS).eq("key", key).maybeSingle();
  if (data) return rowToContent(data as EmailTemplateRow);
  const fallback = SYSTEM_TEMPLATE_DEFAULTS[key];
  return {
    category: fallback.category,
    subject: fallback.subject,
    preheader: fallback.preheader,
    heading: fallback.heading,
    body: fallback.body,
    buttonLabel: fallback.buttonLabel,
    buttonUrl: fallback.buttonUrl,
    useRawHtml: fallback.useRawHtml,
    rawHtml: fallback.rawHtml,
  };
}
