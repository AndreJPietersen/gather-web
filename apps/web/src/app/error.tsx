"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Catches unexpected runtime errors below the root layout and shows a calm
// fallback instead of a blank screen. Sentry (or similar) hooks in here later
// (L3, needs an account).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold text-ink">Something went wrong</h1>
      <p className="text-sm font-semibold text-text-muted">
        That wasn&apos;t supposed to happen. Try again, and if it keeps happening let us know.
      </p>
      <Button variant="primary" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
