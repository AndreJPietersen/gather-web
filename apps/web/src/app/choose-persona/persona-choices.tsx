"use client";

import { LinkCard } from "@/components/ui/card";
import { usePersonaStore } from "@/components/providers/persona-provider";
import { personaKey } from "@/lib/stores/persona-store";
import { categoryGradient, vendorInitials } from "@/lib/vendor-gradient";
import type { Persona } from "@/lib/session";

const ROLE_LABELS = { owner: "Owner", manager: "Manager", staff: "Staff" } as const;

// One tappable card per persona. Setting the active persona *before*
// navigating matters for Planner: "/" carries no persona in its URL, so
// without it someone who was last acting as a vendor would land on Home
// still showing that vendor's tabs.
export function PersonaChoices({ personas, displayName }: { personas: Persona[]; displayName: string | null }) {
  const setActivePersona = usePersonaStore((state) => state.setActivePersona);

  return (
    <div className="flex flex-col gap-3">
      {personas.map((persona) => {
        const isPlanner = persona.type === "planner";
        const title = isPlanner ? "Planner" : persona.vendorName;
        const subtitle = isPlanner ? `Plan your events${displayName ? ` as ${displayName}` : ""}` : `${ROLE_LABELS[persona.role]} · vendor dashboard`;
        return (
          <LinkCard
            key={personaKey(persona)}
            href={isPlanner ? "/" : `/vendor/${persona.vendorId}/dashboard`}
            onClick={() => setActivePersona(persona)}
            className="flex items-center gap-3.5"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill font-display text-base font-semibold text-white"
              style={{
                background: isPlanner
                  ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-glow))"
                  : categoryGradient(persona.vendorName, true),
              }}
            >
              {isPlanner ? vendorInitials(displayName ?? "Planner") : vendorInitials(persona.vendorName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-extrabold text-ink">{title}</span>
              <span className="block truncate text-xs font-semibold text-text-muted">{subtitle}</span>
            </span>
            <span aria-hidden className="text-lg font-extrabold text-text-muted">
              ›
            </span>
          </LinkCard>
        );
      })}
    </div>
  );
}
