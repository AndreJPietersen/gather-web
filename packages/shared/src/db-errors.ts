// Turns the database's anti-abuse refusals into messages a person can act on.
// Those limits are enforced by triggers (so they can't be skipped through the
// API) and surface to the app as ordinary insert errors; without this every
// one of them reads as "Something went wrong".
//   - "Rate limit reached for <table>" — enforce_write_rate_limit (hourly, per person)
//   - "Daily listing limit reached"   — enforce_listing_daily_limit
//   - "Account suspended"             — block_suspended_writes
export function friendlyWriteError(error: { message?: string } | null | undefined, fallback: string): string {
  const message = error?.message ?? "";
  if (message.includes("Rate limit reached")) {
    return "You're doing that a lot — please wait a little while and try again.";
  }
  if (message.includes("Daily listing limit")) {
    return "You've reached today's limit for adding listings. Please try again tomorrow.";
  }
  if (message.includes("Account suspended")) {
    return "Your account has been suspended.";
  }
  return fallback;
}
