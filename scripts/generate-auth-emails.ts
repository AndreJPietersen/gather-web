// Generates the Supabase Auth email templates (confirm sign-up, reset
// password, magic link, change email) in the Gather email layout, so they
// match every other email Gather sends. Output: supabase/templates/*.html,
// referenced from supabase/config.toml. Run: npm run auth-emails
//
// The templates are Go templates evaluated by Supabase Auth ({{ .TokenHash }}
// etc.), not by us. The link goes to our /auth/confirm route with the
// one-time token hash, which works with any Supabase project settings.
import fs from "node:fs";
import path from "node:path";
import { renderEmail, type EmailTemplateContent } from "../packages/shared/src/email/layout";

const PLACEHOLDER = "https://gather.invalid/link";
const SITE = "{{ .SiteURL }}";

interface AuthEmail {
  file: string;
  subject: string;
  heading: string;
  body: string;
  button: string;
  type: string;
  next: string;
  note: string;
}

const EMAILS: AuthEmail[] = [
  {
    file: "confirmation.html",
    subject: "Confirm your Gather account",
    heading: "Welcome to Gather",
    body: "Tap the button to confirm your email address and finish creating your account.",
    button: "Confirm my email",
    type: "email",
    next: "/",
    note: "You're getting this because someone signed up to Gather with this email address. If that wasn't you, ignore this email.",
  },
  {
    file: "recovery.html",
    subject: "Reset your Gather password",
    heading: "Reset your password",
    body: "Tap the button to choose a new password. The link works once and expires soon.",
    button: "Choose a new password",
    type: "recovery",
    next: "/reset-password",
    note: "You're getting this because a password reset was requested for your Gather account. If that wasn't you, ignore this email and your password stays the same.",
  },
  {
    file: "magic_link.html",
    subject: "Your Gather sign-in link",
    heading: "Sign in to Gather",
    body: "Tap the button to sign in. The link works once and expires soon.",
    button: "Sign in",
    type: "magiclink",
    next: "/",
    note: "You're getting this because a sign-in link was requested for your Gather account. If that wasn't you, ignore this email.",
  },
  {
    file: "email_change.html",
    subject: "Confirm your new Gather email",
    heading: "Confirm your new email",
    body: "Tap the button to confirm this as the email address for your Gather account.",
    button: "Confirm new email",
    type: "email_change",
    next: "/profile",
    note: "You're getting this because a change of email address was requested for your Gather account. If that wasn't you, ignore this email.",
  },
];

const outDir = path.resolve(import.meta.dirname, "../supabase/templates");
fs.mkdirSync(outDir, { recursive: true });

for (const e of EMAILS) {
  const template: EmailTemplateContent = {
    category: "transactional",
    subject: e.subject,
    preheader: e.body,
    heading: e.heading,
    body: e.body,
    buttonLabel: e.button,
    buttonUrl: PLACEHOLDER,
    useRawHtml: false,
    rawHtml: null,
  };
  const { html } = renderEmail(template, {}, { siteUrl: SITE, footerNote: e.note });
  const link = `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${e.type}&amp;next=${e.next}`;
  if (!html.includes(PLACEHOLDER)) throw new Error(`${e.file}: button link not found in rendered email`);
  fs.writeFileSync(path.join(outDir, e.file), html.replaceAll(PLACEHOLDER, link) + "\n");
  console.log(`wrote supabase/templates/${e.file}`);
}
