import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { emailSiteUrl } from "@/lib/email";
import { getTemplate, rowToContent } from "@/lib/email/templates";
import { TemplateEditor } from "../../template-editor";
import { deleteTemplate, duplicateTemplate } from "../../actions";

export default async function EditEmailTemplatePage({ params, searchParams }: PageProps<"/admin/emails/templates/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const template = await getTemplate(id);
  if (!template) notFound();
  const isSystem = template.kind === "system";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <BackButton />
          <h1 className="font-display text-2xl font-semibold text-ink">{template.name}</h1>
        </div>
        <div className="flex gap-2">
          <form action={duplicateTemplate}>
            <input type="hidden" name="templateId" value={template.id} />
            <Button type="submit" variant="secondary">
              Duplicate
            </Button>
          </form>
          {!isSystem && (
            <form action={deleteTemplate}>
              <input type="hidden" name="templateId" value={template.id} />
              <Button type="submit" variant="secondary">
                Delete
              </Button>
            </form>
          )}
        </div>
      </div>
      <TemplateEditor
        key={template.updated_at}
        templateId={template.id}
        templateKey={template.key}
        name={template.name}
        isSystem={isSystem}
        content={rowToContent(template)}
        siteUrl={emailSiteUrl()}
        justSaved={saved === "1"}
      />
    </div>
  );
}
