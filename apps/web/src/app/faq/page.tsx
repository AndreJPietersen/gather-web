import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { FAQ_SECTIONS } from "@gather/shared/faq-content";

// Public — no session check, same posture as /vendors: a guest deciding
// whether to sign up has just as much reason to read this as an existing
// user does. Pure server-rendered content, no client JS: each question is a
// plain <details>/<summary> accordion, the exact pattern already
// established on the Attendees page and the Budget suggestions panel,
// rather than a new client-side collapsible component for one more page.
export default function FaqPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="FAQ">
        <p className="text-sm font-semibold text-text-muted">Answers to what people ask us most.</p>
      </PageHeader>

      {FAQ_SECTIONS.map((section) => (
        <div key={section.category}>
          <h2 className="font-display text-lg font-semibold text-ink">{section.category}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {section.items.map((item) => (
              <details
                key={item.question}
                className="group rounded-[18px] bg-surface p-4 shadow-[0_6px_16px_-8px_var(--color-ink)]"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-text marker:content-none">
                  {item.question}
                  <span className="shrink-0 text-text-muted transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-2 text-sm font-semibold text-text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      ))}

      <Card className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-text">Still stuck?</p>
        <Link href="/profile/cases/new" className="shrink-0 text-xs font-extrabold text-primary">
          Report an Issue
        </Link>
      </Card>
    </main>
  );
}
