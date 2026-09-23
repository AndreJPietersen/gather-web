import { Resend } from "resend";
import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM ?? "Gather <onboarding@resend.dev>";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  ok: boolean;
  error?: string;
}

// Resend when RESEND_API_KEY is set — the real path for any deploy, and for
// local dev too once a key is added. Without one, falls back to the local
// Supabase CLI's own email catcher (supabase/config.toml's [local_smtp],
// Mailpit) on the host port it exposes — so a real inbox is never touched
// and no Resend quota gets burned just by developing locally. View what
// "sent" there at http://localhost:54324.
//
// Never throws — callers treat email as best-effort, the same posture every
// other side-effect-only write in this app already has (e.g. a failed
// Storage cleanup after a rolled-back insert). A caller that needs to know
// whether it actually sent checks the returned `ok`.
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  try {
    if (apiKey) {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({ from: FROM, to, subject, html });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    }

    const transport = nodemailer.createTransport({
      host: process.env.LOCAL_SMTP_HOST ?? "127.0.0.1",
      port: Number(process.env.LOCAL_SMTP_PORT ?? 54325),
      secure: false,
      ignoreTLS: true,
    });
    await transport.sendMail({ from: FROM, to, subject, html });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

// No NEXT_PUBLIC_SITE_URL exists yet anywhere in this app (no production
// deploy has happened — see docs/gather_web_architecture.md's Vercel-login
// item). EMAIL_SITE_URL is a narrower, email-only stand-in so reminder
// emails can still link back into the app during local dev; set it to the
// real deployed origin once one exists, or fold it into a proper
// site-wide env var if other features grow the same need.
export function emailSiteUrl(): string {
  return process.env.EMAIL_SITE_URL ?? "http://localhost:3000";
}
