import type { EmailTemplateContent } from "./layout";
import type { MergeVars } from "./merge";

// Which {{fields}} a template can use, with a sample value for the editor's
// live preview. Every template gets the standard ones; the four system
// templates (the automatic reminders) add their own.

export interface MergeField {
  key: string;
  label: string;
  sample: string;
}

export const STANDARD_FIELDS: MergeField[] = [
  { key: "first_name", label: "First name", sample: "Thandi" },
  { key: "name", label: "Full name", sample: "Thandi Mokoena" },
  { key: "email", label: "Email", sample: "thandi@example.com" },
  { key: "site_url", label: "Gather link", sample: "https://gather.example" },
];

const PAYMENT_FIELDS: MergeField[] = [
  { key: "amount", label: "Amount", sample: "R 6 000,00" },
  { key: "vendor_name", label: "Vendor", sample: "Golden Hour Photography" },
  { key: "event_name", label: "Event", sample: "Thandi & Sipho's Wedding" },
  { key: "due_date", label: "Due date", sample: "12 Dec 2026" },
  { key: "link", label: "Payment link", sample: "https://gather.example/events/123/payments" },
];

const TASK_FIELDS: MergeField[] = [
  { key: "task_title", label: "Task", sample: "Confirm the cake tasting" },
  { key: "event_name", label: "Event", sample: "Thandi & Sipho's Wedding" },
  { key: "due_date", label: "Due date", sample: "12 Dec 2026" },
  { key: "link", label: "Task link", sample: "https://gather.example/events/123/tasks" },
];

export type SystemTemplateKey = "payment_due_soon" | "payment_overdue" | "task_due_soon" | "task_overdue";

export const SYSTEM_TEMPLATE_FIELDS: Record<SystemTemplateKey, MergeField[]> = {
  payment_due_soon: PAYMENT_FIELDS,
  payment_overdue: PAYMENT_FIELDS,
  task_due_soon: TASK_FIELDS,
  task_overdue: TASK_FIELDS,
};

export function fieldsForTemplate(key: string | null): MergeField[] {
  const extra = key && key in SYSTEM_TEMPLATE_FIELDS ? SYSTEM_TEMPLATE_FIELDS[key as SystemTemplateKey] : [];
  return [...STANDARD_FIELDS, ...extra];
}

export function sampleVars(key: string | null): MergeVars {
  return Object.fromEntries(fieldsForTemplate(key).map((f) => [f.key, f.sample]));
}

// The built-in wording for the automatic emails — seeded into
// email_templates (migration 0056) and used as a fallback if a row is ever
// missing. Admins reword them at /admin/emails.
export const SYSTEM_TEMPLATE_DEFAULTS: Record<SystemTemplateKey, { name: string } & EmailTemplateContent> = {
  payment_due_soon: {
    name: "Payment due soon (automatic)",
    category: "transactional",
    subject: "Payment due soon: {{amount}} to {{vendor_name}}",
    preheader: "{{vendor_name}} — due {{due_date}}",
    heading: "A payment is coming up",
    body: "Hi {{first_name}},\n\nA payment for **{{event_name}}** is due soon:\n\n- **{{vendor_name}}** — {{amount}}\n- Due {{due_date}}",
    buttonLabel: "View this payment",
    buttonUrl: "{{link}}",
    useRawHtml: false,
    rawHtml: null,
  },
  payment_overdue: {
    name: "Payment overdue (automatic)",
    category: "transactional",
    subject: "Overdue: {{amount}} to {{vendor_name}}",
    preheader: "{{vendor_name}} — was due {{due_date}}",
    heading: "A payment is overdue",
    body: "Hi {{first_name}},\n\nA payment for **{{event_name}}** has passed its due date:\n\n- **{{vendor_name}}** — {{amount}}\n- Was due {{due_date}}\n\nIf you've already paid, mark it paid on Gather so everyone stays in sync.",
    buttonLabel: "View this payment",
    buttonUrl: "{{link}}",
    useRawHtml: false,
    rawHtml: null,
  },
  task_due_soon: {
    name: "Task due soon (automatic)",
    category: "transactional",
    subject: "Task due soon: {{task_title}}",
    preheader: "For {{event_name}} — due {{due_date}}",
    heading: "A task is coming up",
    body: "Hi {{first_name}},\n\n**{{task_title}}** for {{event_name}} is due {{due_date}}.",
    buttonLabel: "View this task",
    buttonUrl: "{{link}}",
    useRawHtml: false,
    rawHtml: null,
  },
  task_overdue: {
    name: "Task overdue (automatic)",
    category: "transactional",
    subject: "Overdue: {{task_title}}",
    preheader: "For {{event_name}} — was due {{due_date}}",
    heading: "A task is overdue",
    body: "Hi {{first_name}},\n\n**{{task_title}}** for {{event_name}} was due {{due_date}}.",
    buttonLabel: "View this task",
    buttonUrl: "{{link}}",
    useRawHtml: false,
    rawHtml: null,
  },
};

export const REMINDER_FOOTER = "You're getting this because email reminders are on in your Gather notification settings.";

// First name for {{first_name}}: the display name's first word, or a
// friendly fallback so "Hi {{first_name}}," never reads "Hi ,".
export function firstNameOf(displayName: string | null | undefined): string {
  const first = (displayName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}
