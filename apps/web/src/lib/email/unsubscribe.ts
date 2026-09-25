import { createHmac, timingSafeEqual } from "node:crypto";

// Signed unsubscribe links: /unsubscribe?e=<email>&t=<token>, where the token
// is an HMAC of the lower-cased address. Nobody can unsubscribe someone else
// by guessing a URL, and no login is needed (the law and common sense both
// say unsubscribing must be one click from the email itself).
// Server-only (node:crypto) — never import this from a client component.

function secret(): string {
  // Set EMAIL_UNSUBSCRIBE_SECRET in every real environment. The fallback
  // only exists so local development works out of the box.
  return process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "gather-dev-unsubscribe-secret";
}

export function unsubscribeToken(email: string): string {
  return createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("base64url");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(siteUrl: string, email: string): string {
  const e = encodeURIComponent(email.trim().toLowerCase());
  return `${siteUrl.replace(/\/$/, "")}/unsubscribe?e=${e}&t=${unsubscribeToken(email)}`;
}
