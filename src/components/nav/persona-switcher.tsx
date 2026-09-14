"use client";

import { cn } from "@/lib/utils";
import { personaKey } from "@/lib/stores/persona-store";
import { usePersonaStore } from "@/components/providers/persona-provider";

export function PersonaSwitcher() {
  const personas = usePersonaStore((state) => state.personas);
  const activePersona = usePersonaStore((state) => state.activePersona);
  const setActivePersona = usePersonaStore((state) => state.setActivePersona);

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pt-3">
      {personas.map((persona) => {
        const isActive = personaKey(persona) === personaKey(activePersona);
        const text = persona.type === "planner" ? "Planner" : persona.vendorName;

        return (
          <button
            key={personaKey(persona)}
            type="button"
            onClick={() => setActivePersona(persona)}
            className={cn(
              "shrink-0 rounded-pill border-2 px-4 py-1.5 text-xs font-extrabold transition-opacity",
              isActive ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text-muted",
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
