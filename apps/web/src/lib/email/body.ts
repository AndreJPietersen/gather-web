import { EMAIL_COLORS } from "./brand";
import { escapeHtml, mergeFields, safeUrl, type MergeVars } from "./merge";

// The "blocks" body format admins type into the template editor — plain
// text with a few light conventions, so nobody has to write HTML (or can
// break the email's layout by accident):
//   blank line      → new paragraph
//   **bold**        → bold
//   [text](url)     → link (http/https/mailto, or /path on the site)
//   lines "- item"  → bullet list
//   single newline  → line break
// The text is escaped first, then merge values (also escaped) are filled in,
// then the conventions above are applied — so nothing typed or merged can
// become raw HTML.
const P_STYLE = `margin:0 0 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.text};`;
const LINK_STYLE = `color:${EMAIL_COLORS.primary};font-weight:700;text-decoration:underline;`;

function inline(text: string, siteUrl: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
      const href = safeUrl(url.replace(/&amp;/g, "&"), siteUrl);
      return href ? `<a href="${escapeHtml(href)}" style="${LINK_STYLE}">${label}</a>` : label;
    });
}

export function blocksToHtml(body: string, vars: MergeVars, siteUrl: string): string {
  const merged = mergeFields(escapeHtml(body.replace(/\r\n/g, "\n")), vars, true);
  return merged
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*-\s+/.test(l))) {
        const items = lines.map((l) => `<li style="margin:0 0 6px;">${inline(l.replace(/^\s*-\s+/, ""), siteUrl)}</li>`).join("");
        return `<ul style="margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.text};">${items}</ul>`;
      }
      return `<p style="${P_STYLE}">${lines.map((l) => inline(l, siteUrl)).join("<br>")}</p>`;
    })
    .join("\n");
}

// Raw-HTML mode: the admin writes the inner content themselves. Admins are
// trusted, but scripts, frames, event handlers and javascript: links are
// still stripped — mail clients would strip most of it anyway, and it keeps
// a pasted snippet from doing anything surprising in the admin preview.
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|meta|link)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*/gi, '$1=$2#');
}

// Plain-text version for the text/plain part (and clients that prefer it).
export function htmlToText(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
