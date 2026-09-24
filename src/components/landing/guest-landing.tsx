"use client";

import { CalendarCheck, PartyPopper, Handshake } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { LinkCard } from "@/components/ui/card";
import { GatherWordmark } from "@/components/brand/gather-wordmark";
import { GatherTentArt } from "@/components/brand/gather-tent-art";
import { VendorAvatar } from "@/components/vendor/vendor-avatar";
import { VendorRatingBadge } from "@/components/vendor/vendor-rating-badge";
import { formatEventDateTime } from "@/lib/utils";
import type { RatingSummary } from "@/lib/vendor-reviews";

interface PublicEvent {
  id: string;
  name: string;
  event_type: string | null;
  start_at: string;
  location: string | null;
}

interface TeaserVendor {
  id: string;
  name: string;
  primary_category: string | null;
  is_featured: boolean;
  logo_path: string | null;
}

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Plan without the spreadsheet",
    description: "Invites, tasks, and vendor bookings live in one place — no more juggling three apps.",
  },
  {
    icon: Handshake,
    title: "Book vendors you can trust",
    description: "Every vendor is verified before their badge goes green, so you know who you're dealing with.",
  },
  {
    icon: PartyPopper,
    title: "Free to plan, always",
    description: "No commission, no premium tier for the basics — Gather makes money from vendors, not planners.",
  },
];

export function GuestLanding({
  events,
  vendors,
  vendorLogoUrls,
  vendorRatingSummaries,
}: {
  events: PublicEvent[] | null;
  vendors: TeaserVendor[] | null;
  vendorLogoUrls: Map<string, string>;
  vendorRatingSummaries: Map<string, RatingSummary>;
}) {
  return (
    <div className="flex flex-col gap-10 pb-4">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-b-[36px] bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] px-6 pb-10 pt-12 text-white"
      >
        <div className="relative flex flex-col items-center gap-4 text-center">
          <GatherTentArt className="w-[156px]" />
          <GatherWordmark className="-mt-1 text-[46px]" />
          <h1 className="font-display text-[28px] font-bold leading-tight">Plan it. Book it. Pull it off.</h1>
          <p className="text-sm font-semibold text-white/90">
            Gather brings your guest list, your to-dos, and your vendors into one free planning hub.
          </p>
          <div className="mt-2 flex w-full flex-col gap-2">
            <LinkButton href="/register?persona=planner" variant="secondary" className="bg-white text-primary shadow-lg">
              Plan an Event
            </LinkButton>
            <LinkButton
              href="/register?persona=vendor"
              variant="secondary"
              className="border-white/60 bg-transparent text-white"
            >
              List Your Business
            </LinkButton>
          </div>
        </div>
      </motion.section>

      <section className="flex flex-col gap-4 px-6">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.08, type: "spring", stiffness: 300, damping: 26 }}
            className="flex items-start gap-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <feature.icon size={20} strokeWidth={2.5} />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-ink">{feature.title}</p>
              <p className="mt-0.5 text-xs font-semibold text-text-muted">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </section>

      <section className="flex flex-col gap-3 px-6">
        <h2 className="font-display text-lg font-semibold text-ink">Upcoming Events</h2>
        {events && events.length > 0 ? (
          <div className="flex flex-col gap-3">
            {events.map((event) => (
              <LinkCard key={event.id} href={`/events/${event.id}`}>
                <p className="text-sm font-extrabold text-text">{event.name}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {formatEventDateTime(event.start_at)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </LinkCard>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-text-muted">No public events yet — check back soon.</p>
        )}
      </section>

      <section className="flex flex-col gap-3 pl-6">
        <div className="flex items-baseline justify-between pr-6">
          <h2 className="font-display text-lg font-semibold text-ink">Vendors near you</h2>
          <Link href="/vendors" className="flex items-center gap-0.5 text-xs font-extrabold text-primary">
            See all
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </Link>
        </div>
        {vendors && vendors.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 pr-6">
            {vendors.map((vendor) => (
              <LinkCard
                key={vendor.id}
                href={`/vendors/${vendor.id}`}
                className="flex w-40 shrink-0 flex-col gap-2 rounded-[26px] p-4"
              >
                {vendor.is_featured && (
                  <span className="flex w-fit items-center gap-1 rounded-pill bg-secondary px-2 py-0.5 text-[9px] font-extrabold uppercase text-ink">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--color-ink)">
                      <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2"></polygon>
                    </svg>
                    Featured
                  </span>
                )}
                <VendorAvatar
                  name={vendor.name}
                  category={vendor.primary_category}
                  verified
                  logoUrl={vendorLogoUrls.get(vendor.id) ?? null}
                  size={44}
                  radius={14}
                />
                <div>
                  <p className="text-sm font-extrabold text-text">{vendor.name}</p>
                  {vendor.primary_category && <p className="text-xs font-semibold text-text-muted">{vendor.primary_category}</p>}
                </div>
                {vendorRatingSummaries.has(vendor.id) && (
                  <VendorRatingBadge average={vendorRatingSummaries.get(vendor.id)!.average} count={vendorRatingSummaries.get(vendor.id)!.count} />
                )}
              </LinkCard>
            ))}
          </div>
        ) : (
          <p className="pr-6 text-sm font-semibold text-text-muted">No verified vendors yet — check back soon.</p>
        )}
      </section>

      <p className="px-6 text-center text-xs font-semibold text-text-muted">
        Have questions before you sign up?{" "}
        <Link href="/faq" className="font-extrabold text-primary">
          Check our FAQ
        </Link>
      </p>
    </div>
  );
}
