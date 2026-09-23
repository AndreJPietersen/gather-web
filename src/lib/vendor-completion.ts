// Drives two things: the "Complete your profile" checklist on the vendor's
// own dashboard, and (via its numeric score alone) sort order on Home's
// vendor teaser and the /vendors marketplace — a self-serve way for a
// vendor to earn a better spot, alongside the admin-curated Featured flag.
// Computed live from real data every time, deliberately never stored as its
// own column: a stored "completion score" is exactly the kind of flag this
// app has already been bitten by once (installment_status's dead "late"
// value, found this same week — see docs/gather_web_architecture.md's
// 2026-09-16 email/reminders entry) — a value nothing keeps in sync always
// eventually drifts from reality.
export interface VendorCompletionInput {
  logoPath: string | null;
  description: string | null;
  galleryCount: number;
  servicesCount: number;
  socialLinksCount: number;
}

export interface VendorCompletionItem {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
}

export interface VendorCompletionResult {
  doneCount: number;
  totalCount: number;
  percent: number;
  items: VendorCompletionItem[];
}

const MIN_GALLERY_PHOTOS = 3;

export function getVendorCompletion(input: VendorCompletionInput): VendorCompletionResult {
  const items: VendorCompletionItem[] = [
    { key: "logo", label: "Logo photo added", done: Boolean(input.logoPath) },
    { key: "description", label: "Business description", done: Boolean(input.description?.trim()) },
    {
      key: "gallery",
      label: `Add ${MIN_GALLERY_PHOTOS}+ gallery photos`,
      done: input.galleryCount >= MIN_GALLERY_PHOTOS,
      detail: `${Math.min(input.galleryCount, MIN_GALLERY_PHOTOS)} of ${MIN_GALLERY_PHOTOS} added`,
    },
    { key: "services", label: "Services listed", done: input.servicesCount > 0 },
    { key: "social", label: "Add a social link", done: input.socialLinksCount > 0 },
  ];

  const doneCount = items.filter((item) => item.done).length;
  return {
    doneCount,
    totalCount: items.length,
    percent: Math.round((doneCount / items.length) * 100),
    items,
  };
}
