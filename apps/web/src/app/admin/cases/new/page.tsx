import { requireAdmin } from "@/lib/admin/require-admin";
import { BackButton } from "@/components/ui/back-button";
import { NewCaseForm } from "./new-case-form";

export default async function NewCasePage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">New Case</h1>
      </div>
      <NewCaseForm />
    </div>
  );
}
