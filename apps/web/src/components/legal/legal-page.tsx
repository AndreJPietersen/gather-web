import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_INFO, LEGAL_IS_DRAFT } from "@gather/shared/legal-info";
import { PageHeader } from "@/components/ui/page-header";

// Shared frame for the privacy policy and terms: header, the "draft" banner
// while the wording hasn't been reviewed, and the last-updated line.
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-6 py-10">
      <PageHeader title={title}>
        <p className="text-sm font-semibold text-text-muted">Last updated {LEGAL_INFO.lastUpdated}</p>
      </PageHeader>
      {LEGAL_IS_DRAFT && (
        <p className="rounded-[18px] bg-surface p-4 text-sm font-bold text-primary shadow-[0_6px_16px_-8px_var(--color-ink)]">
          Draft — this text has not yet been reviewed by a lawyer and the company details are placeholders.
        </p>
      )}
      <div className="flex flex-col gap-4 text-sm font-semibold leading-relaxed text-text">{children}</div>
      <p className="text-xs font-semibold text-text-muted">
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
        {" · "}
        <Link href="/terms" className="underline">
          Terms of use
        </Link>
        {" · "}
        <Link href="/faq" className="underline">
          FAQ
        </Link>
      </p>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** "Privacy policy · Terms of use" links, for footers of public and auth pages. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-center text-xs font-semibold text-text-muted"}>
      <Link href="/privacy" className="underline">
        Privacy policy
      </Link>
      {" · "}
      <Link href="/terms" className="underline">
        Terms of use
      </Link>
    </p>
  );
}
