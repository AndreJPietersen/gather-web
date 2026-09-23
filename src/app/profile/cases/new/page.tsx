import { PageHeader } from "@/components/ui/page-header";
import { getSessionContext } from "@/lib/session";
import { redirect } from "next/navigation";
import { NewCaseForm } from "./new-case-form";

export default async function NewSupportCasePage() {
  const session = await getSessionContext();
  if (session.status !== "authenticated") {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Report an Issue">
        <p className="text-sm font-semibold text-text-muted">
          Tell us what&apos;s going on and we&apos;ll take a look — you&apos;ll be able to check back on the status here.
        </p>
      </PageHeader>
      <NewCaseForm />
    </main>
  );
}
