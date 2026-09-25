import { createStore } from "zustand/vanilla";
import type { Persona } from "@/lib/session";

export function personaKey(persona: Persona): string {
  return persona.type === "planner" ? "planner" : `vendor:${persona.vendorId}`;
}

export interface PersonaState {
  personas: Persona[];
  activePersona: Persona;
  setActivePersona: (persona: Persona) => void;
  // Re-syncs the persona list from a fresh server render (see
  // PersonaProvider's effect) — the root layout persists across
  // client-side navigation, so this store is NOT recreated just because
  // new personas arrived via props; without an explicit sync, a vendor
  // created after this store's first mount would never appear. `preferred`
  // (derived from the current URL) wins if given; otherwise the current
  // active persona is kept if it still exists, falling back to the first.
  setPersonas: (personas: Persona[], preferred?: Persona) => void;
}

/**
 * A fresh store per Provider instance, not a module-level singleton — a
 * global Zustand store would be created once per server process and shared
 * across concurrent requests' server-rendered HTML, leaking one user's
 * personas into another's initial render. See PersonaProvider, which creates
 * exactly one of these per component instance via useState's lazy
 * initializer.
 *
 * `initialActive` lets the caller seed which persona should be active on
 * first render (see PersonaProvider deriving it from the current URL) —
 * without it, defaulting to `personas[0]` (always Planner) would mean a
 * vendor landing straight on their own dashboard after onboarding sees the
 * Planner tab set instead of their Vendor one.
 */
export function createPersonaStore(personas: Persona[], initialActive?: Persona) {
  return createStore<PersonaState>((set) => ({
    personas,
    activePersona: initialActive ?? personas[0] ?? { type: "planner" },
    setActivePersona: (persona) => set({ activePersona: persona }),
    setPersonas: (nextPersonas, preferred) =>
      set((state) => {
        const stillActive = preferred ?? nextPersonas.find((p) => personaKey(p) === personaKey(state.activePersona));
        return {
          personas: nextPersonas,
          activePersona: stillActive ?? nextPersonas[0] ?? { type: "planner" },
        };
      }),
  }));
}

export type PersonaStoreApi = ReturnType<typeof createPersonaStore>;
