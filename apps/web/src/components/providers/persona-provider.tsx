"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "zustand";
import { createPersonaStore, type PersonaState, type PersonaStoreApi } from "@/lib/stores/persona-store";
import type { Persona } from "@/lib/session";

const PersonaStoreContext = createContext<PersonaStoreApi | null>(null);

function vendorPersonaForPath(pathname: string, personas: Persona[]): Persona | undefined {
  const vendorIdInPath = pathname.match(/^\/vendor\/([^/]+)/)?.[1];
  return vendorIdInPath ? personas.find((p) => p.type === "vendor" && p.vendorId === vendorIdInPath) : undefined;
}

export function PersonaProvider({ personas, children }: { personas: Persona[]; children: ReactNode }) {
  const pathname = usePathname();

  // useState's lazy initializer (not useRef) is the compiler-safe way to
  // create this once per Provider instance — accessing ref.current during
  // render, even in the usual "lazy ref init" idiom, is flagged by this
  // project's react-hooks/refs lint rule.
  const [store] = useState<PersonaStoreApi>(() => createPersonaStore(personas, vendorPersonaForPath(pathname, personas)));

  // The root layout persists across client-side navigation (it doesn't
  // remount), so the lazy initializer above only ever runs once per browser
  // session — it will NOT re-run just because a fresh `personas` prop
  // arrives later (e.g. right after vendor onboarding creates a new
  // business). Found by testing the real onboarding flow: without this
  // effect, a brand-new vendor owner redirected straight to their own
  // dashboard still saw the Planner tab set, because the store's personas
  // list was frozen at whatever it was when this component first mounted.
  useEffect(() => {
    store.getState().setPersonas(personas, vendorPersonaForPath(pathname, personas));
  }, [store, personas, pathname]);

  return <PersonaStoreContext.Provider value={store}>{children}</PersonaStoreContext.Provider>;
}

export function usePersonaStore<T>(selector: (state: PersonaState) => T): T {
  const store = useContext(PersonaStoreContext);
  if (!store) {
    throw new Error("usePersonaStore must be used within a PersonaProvider");
  }
  return useStore(store, selector);
}
