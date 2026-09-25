import { EMAIL_COLORS as C, EMAIL_FONT } from "./brand";
import { blocksToHtml, htmlToText, sanitizeEmailHtml } from "./body";
import { escapeHtml, mergeFields, safeUrl, type MergeVars } from "./merge";

// The one Gather email layout every email uses — admin-sent and automatic
// alike. Pure (no server-only imports), so the admin template editor renders
// its live preview with exactly the same code the send path uses.
//
// Email HTML is its own dialect: table-based layout, inline styles, a 600px
// column, no SVG, no CSS variables, no web fonts. See teachAndre/27.

export type EmailCategory = "transactional" | "announcement";

export interface EmailTemplateContent {
  category: EmailCategory;
  subject: string;
  preheader: string | null;
  heading: string | null;
  body: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  useRawHtml: boolean;
  rawHtml: string | null;
}

export interface RenderOptions {
  siteUrl: string;
  // Shown only for announcements; transactional mail (reminders, a direct
  // message to one person) doesn't get one.
  unsubscribeUrl?: string | null;
  // One line explaining why this person got the email.
  footerNote?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function button(label: string, href: string): string {
  // "Bulletproof" button: a table cell with a background colour, so it
  // renders as a button even in Outlook, which ignores most CSS on <a>.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;">
  <tr><td align="center" bgcolor="${C.primary}" style="border-radius:999px;background:${C.primary};background-image:linear-gradient(135deg,${C.primary},${C.glow});">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 30px;font-family:${EMAIL_FONT};font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
  </td></tr>
</table>`;
}

export function renderEmail(template: EmailTemplateContent, vars: MergeVars, options: RenderOptions): RenderedEmail {
  const site = options.siteUrl.replace(/\/$/, "");
  const allVars: MergeVars = { site_url: site, ...vars };

  const subject = mergeFields(template.subject, allVars, false).trim() || "A message from Gather";
  const preheader = template.preheader ? mergeFields(template.preheader, allVars, false) : "";
  const heading = template.heading ? mergeFields(escapeHtml(template.heading), allVars, true) : "";

  const inner = template.useRawHtml
    ? mergeFields(sanitizeEmailHtml(template.rawHtml ?? ""), allVars, true)
    : blocksToHtml(template.body ?? "", allVars, site);

  const buttonHref = template.buttonUrl ? safeUrl(mergeFields(template.buttonUrl, allVars, false), site) : null;
  const buttonHtml =
    !template.useRawHtml && template.buttonLabel && buttonHref
      ? button(mergeFields(escapeHtml(template.buttonLabel), allVars, true), buttonHref)
      : "";

  const unsubscribe =
    template.category === "announcement" && options.unsubscribeUrl
      ? `<a href="${escapeHtml(options.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">Unsubscribe from Gather announcements</a>`
      : "";
  const footerNote = options.footerNote ? escapeHtml(options.footerNote) : "";
  const logo = `${site}/icon-512.png`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${escapeHtml(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td bgcolor="${C.primary}" style="background:${C.primary};background-image:linear-gradient(135deg,${C.primary},${C.glow});border-radius:24px 24px 0 0;padding:26px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:12px;"><img src="${logo}" width="44" height="44" alt="" style="display:block;border:0;border-radius:12px;"></td>
        <td style="vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:30px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Gather</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${C.surface};border-radius:0 0 24px 24px;padding:36px 32px 30px;font-family:${EMAIL_FONT};">
      ${heading ? `<h1 style="margin:0 0 18px;font-family:${EMAIL_FONT};font-size:26px;line-height:1.25;font-weight:800;color:${C.ink};">${heading}</h1>` : ""}
      ${inner}
      ${buttonHtml}
    </td></tr>
    <tr><td style="padding:22px 20px 8px;text-align:center;font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${C.muted};">
      ${footerNote ? `${footerNote}<br>` : ""}
      Sent by <a href="${escapeHtml(site)}" style="color:${C.primary};font-weight:700;text-decoration:none;">Gather</a> — plan it, share it, celebrate it.
      ${unsubscribe ? `<br>${unsubscribe}` : ""}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const textParts = [
    heading ? htmlToText(heading) : "",
    htmlToText(inner),
    buttonHtml && buttonHref ? `${htmlToText(template.buttonLabel ?? "")}: ${buttonHref}` : "",
    "—",
    options.footerNote ?? "",
    `Sent by Gather — ${site}`,
    unsubscribe && options.unsubscribeUrl ? `Unsubscribe: ${options.unsubscribeUrl}` : "",
  ].filter(Boolean);

  return { subject, html, text: textParts.join("\n\n") };
}
