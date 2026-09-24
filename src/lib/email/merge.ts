// Merge fields: {{first_name}} style placeholders filled per recipient.
// Every value is HTML-escaped before it lands in the email, so a planner who
// names a task "<script>" (or a vendor called "Tom & Co") can never inject
// markup into someone's inbox. Unknown fields are left exactly as typed, so
// a typo like {{frist_name}} is visible in the preview instead of silently
// vanishing.

export type MergeVars = Record<string, string | null | undefined>;

const FIELD = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Fills placeholders. html=true escapes each value (for HTML bodies);
// html=false leaves them as plain text (subject lines, the text version).
export function mergeFields(template: string, vars: MergeVars, html: boolean): string {
  return template.replace(FIELD, (match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return match;
    return html ? escapeHtml(value) : value;
  });
}

// Links in emails may only go to web pages (or mailto). A relative path
// ("/events/new") is resolved against the site URL so templates don't need
// to hard-code a domain. Anything else — javascript:, data:, garbage — is
// dropped.
export function safeUrl(raw: string, siteUrl: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith("/")) return siteUrl.replace(/\/$/, "") + url;
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
  return null;
}

// The placeholders a template uses, for showing which ones are unknown.
export function fieldsUsed(template: string): string[] {
  return Array.from(new Set(Array.from(template.matchAll(FIELD), (m) => m[1])));
}
