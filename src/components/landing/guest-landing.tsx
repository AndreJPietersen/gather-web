"use client";

import { CalendarCheck, PartyPopper, Handshake } from "lucide-react";
import { motion } from "motion/react";
import { LinkButton } from "@/components/ui/button";
import { LinkCard } from "@/components/ui/card";
import { formatEventDateTime } from "@/lib/utils";
import { categoryGradient } from "@/lib/vendor-gradient";

interface PublicEvent {
  id: string;
  name: string;
  event_type: string | null;
  start_at: string;
  location: string | null;
}

interface VerifiedVendor {
  id: string;
  name: string;
  primary_category: string | null;
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

// The prototype's decorative "faint white circle" hero texture, ported as
// inline SVG rather than an image or gradient-mesh library — cheap, crisp
// at any DPI, and trivially themeable since it inherits currentColor.
function HeroTexture() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full text-white/25"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
    >
      <circle cx="340" cy="30" r="140" fill="currentColor" opacity="0.5" />
      <circle cx="40" cy="260" r="100" fill="currentColor" opacity="0.35" />
      <circle cx="200" cy="150" r="60" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

export function GuestLanding({ events, vendors }: { events: PublicEvent[] | null; vendors: VerifiedVendor[] | null }) {
  return (
    <div className="flex flex-col gap-10 pb-4">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-b-[36px] bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] px-6 pb-10 pt-14 text-white"
      >
        <HeroTexture />
        <div className="relative flex flex-col gap-4">
          <h1 className="font-display text-4xl font-bold leading-tight">Plan it. Book it. Pull it off.</h1>
          <p className="text-sm font-semibold text-white/90">
            Gather brings your guest list, your to-dos, and your vendors into one free planning hub.
          </p>
          <div className="mt-2 flex flex-col gap-2">
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
        <h2 className="font-display text-lg font-semibold text-ink pr-6">Vendors near you</h2>
        {vendors && vendors.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 pr-6">
            {vendors.map((vendor) => (
              <LinkCard
                key={vendor.id}
                href={`/vendors/${vendor.id}`}
                className="flex w-40 shrink-0 flex-col justify-end gap-1 rounded-[26px] p-4 text-white"
                style={{ background: categoryGradient(vendor.primary_category, true) }}
              >
                <p className="text-sm font-extrabold">{vendor.name}</p>
                {vendor.primary_category && <p className="text-xs font-semibold text-white/80">{vendor.primary_category}</p>}
              </LinkCard>
            ))}
          </div>
        ) : (
          <p className="pr-6 text-sm font-semibold text-text-muted">No verified vendors yet — check back soon.</p>
        )}
      </section>
    </div>
  );
}
