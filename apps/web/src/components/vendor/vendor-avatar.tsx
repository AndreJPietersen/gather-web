import { categoryGradient, vendorInitials } from "@gather/shared/vendor-gradient";

interface VendorAvatarProps {
  name: string;
  category: string | null;
  verified: boolean;
  logoUrl: string | null;
  size?: number;
  radius?: number;
}

// The marketplace redesign's profile-picture treatment, used everywhere a
// vendor is listed (Home's teaser, /vendors, the guest landing page, the
// vendor's own public profile): a real uploaded logo when one exists,
// otherwise the same category-hashed gradient + initials this app already
// used for the guest landing page's vendor cards, generalized into one
// shared component instead of copy-pasted per surface.
export function VendorAvatar({ name, category, verified, logoUrl, size = 44, radius = 14 }: VendorAvatarProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a Storage
      // public URL isn't a static/optimizable asset next/image can
      // source-check at build time.
      <img
        src={logoUrl}
        alt=""
        className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center font-display font-semibold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: categoryGradient(category, verified),
        fontSize: Math.round(size * 0.36),
      }}
    >
      {vendorInitials(name)}
    </div>
  );
}
