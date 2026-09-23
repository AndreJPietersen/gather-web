// Ports the prototype's verified/unverified convention — verified vendors
// get a saturated gradient, unverified/unclaimed ones get a washed-out
// version of the same hue — generalized to work under all 3 themes and
// against free-text vendor categories (there's no fixed category enum,
// see vendors.primary_category in db/schema.ts) by hashing the category
// string into a stable hue rather than hardcoding a lookup table that would
// miss anything a vendor typed that wasn't anticipated.
const DEFAULT_HUE = 325;

function hueForCategory(category: string | null): number {
  if (!category) return DEFAULT_HUE;
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function categoryGradient(category: string | null, verified: boolean): string {
  const hue = hueForCategory(category);
  const chroma = verified ? 0.17 : 0.06;
  const lightness1 = verified ? 60 : 88;
  const lightness2 = verified ? 68 : 92;
  return `linear-gradient(135deg, oklch(${lightness1}% ${chroma} ${hue}), oklch(${lightness2}% ${chroma} ${hue + 25}))`;
}

// The fallback shown inside a VendorAvatar (components/vendor/vendor-
// avatar.tsx) for the — currently common, pre-marketplace-redesign —
// case of a vendor with no logo uploaded yet: first letter of the first
// two words in the name, uppercased, same shape initials-avatars use
// everywhere (Slack, Gmail, etc.).
export function vendorInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
