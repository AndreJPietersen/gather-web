import { requireAdmin } from "@/lib/admin/require-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getFeaturedEnabled,
  getListingDailyLimit,
  getMaxEmailRecipients,
  getMaxOwnedBusinesses,
  getRegistrationEnabled,
  getWriteRateLimits,
} from "@/lib/app-settings";
import { getWatchlistThresholds } from "@/lib/admin/watchlist";
import { setRegistrationEnabled } from "./actions";
import { setFeaturedEnabled } from "../featured/actions";
import { LimitsForm, WatchlistThresholdsForm, WriteRateLimitsForm } from "./settings-forms";

// Every operational knob in one place: app-wide switches, the listing
// limits, the watchlist thresholds and the per-person hourly write limits.
// All stored in the database (app_settings, write_rate_limits) — the limits
// are enforced by database triggers, so a change here applies immediately.
export default async function AdminSettingsPage() {
  await requireAdmin();
  const [registrationEnabled, featuredEnabled, listingDailyLimit, maxOwned, thresholds, rateLimits, maxEmailRecipients] = await Promise.all([
    getRegistrationEnabled(),
    getFeaturedEnabled(),
    getListingDailyLimit(),
    getMaxOwnedBusinesses(),
    getWatchlistThresholds(),
    getWriteRateLimits(),
    getMaxEmailRecipients(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>

      <SwitchCard
        title={registrationEnabled ? "Sign-ups are open" : "Sign-ups are paused"}
        on={registrationEnabled}
        description={
          registrationEnabled
            ? "Anyone can create an account. Pause this if the site is being flooded — existing users can still log in."
            : "Nobody can create an account, including by calling Supabase directly. Existing users can still log in. Accounts made by hand in the Supabase dashboard are blocked too while this is off."
        }
        action={setRegistrationEnabled}
        offLabel="Pause sign-ups"
        onLabel="Open sign-ups"
      />

      <SwitchCard
        title={featuredEnabled ? "Featured vendors are on" : "Featured vendors are off"}
        on={featuredEnabled}
        description="Featured badges, the Featured row and the ranking boost, plus vendors requesting spots. Also on the Featured page."
        action={setFeaturedEnabled}
        offLabel="Turn off"
        onLabel="Turn on"
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <LimitsForm maxOwnedBusinesses={maxOwned} listingDailyLimit={listingDailyLimit} maxEmailRecipients={maxEmailRecipients} />
        <WatchlistThresholdsForm t={thresholds} />
      </div>

      <WriteRateLimitsForm limits={rateLimits} />
    </div>
  );
}

function SwitchCard({
  title,
  on,
  description,
  action,
  offLabel,
  onLabel,
}: {
  title: string;
  on: boolean;
  description: string;
  action: (formData: FormData) => Promise<void>;
  offLabel: string;
  onLabel: string;
}) {
  return (
    <Card className={`flex items-center justify-between gap-6 ${on ? "" : "border-2 border-primary"}`}>
      <div>
        <p className="font-display text-lg font-semibold text-ink">{title}</p>
        <p className="text-xs font-semibold text-text-muted">{description}</p>
      </div>
      <form action={action}>
        <input type="hidden" name="enabled" value={on ? "false" : "true"} />
        <Button type="submit" variant={on ? "secondary" : "primary"}>
          {on ? offLabel : onLabel}
        </Button>
      </form>
    </Card>
  );
}
