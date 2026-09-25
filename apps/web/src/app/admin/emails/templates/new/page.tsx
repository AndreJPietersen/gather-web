import { requireAdmin } from "@/lib/admin/require-admin";
import { BackButton } from "@/components/ui/back-button";
import { emailSiteUrl } from "@/lib/email";
import { TemplateEditor } from "../../template-editor";

export default async function NewEmailTemplatePage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">New email template</h1>
      </div>
      <TemplateEditor
        templateId={null}
        templateKey={null}
        name=""
        isSystem={false}
        siteUrl={emailSiteUrl()}
        content={{
          category: "transactional",
          subject: "",
          preheader: "",
          heading: "Hi {{first_name}}",
          body: "Write your message here.\n\nA blank line starts a new paragraph.",
          buttonLabel: "Open Gather",
          buttonUrl: "/",
          useRawHtml: false,
          rawHtml: "",
        }}
      />
    </div>
  );
}
