import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold text-ink">We couldn&apos;t find that page</h1>
      <p className="text-sm font-semibold text-text-muted">
        The link may be out of date, or the event or business may have been removed.
      </p>
      <LinkButton href="/" variant="primary">
        Back to Gather
      </LinkButton>
      <Link href="/faq" className="text-sm font-extrabold text-primary">
        Read the FAQ
      </Link>
    </main>
  );
}
