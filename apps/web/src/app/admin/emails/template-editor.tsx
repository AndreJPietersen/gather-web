"use client";

import { useActionState, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EmailTemplateContent } from "@gather/shared/email/layout";
import { fieldsForTemplate, sampleVars } from "@gather/shared/email/fields";
import { saveTemplate, sendTestEmail, type EmailActionState } from "./actions";
import { EmailContentEditor, EmailPreview } from "./email-content-editor";

const initial: EmailActionState = {};

export function TemplateEditor({
  templateId,
  templateKey,
  name: initialName,
  isSystem,
  content: initialContent,
  siteUrl,
  justSaved = false,
}: {
  templateId: string | null;
  templateKey: string | null;
  name: string;
  isSystem: boolean;
  content: EmailTemplateContent;
  siteUrl: string;
  justSaved?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);
  const [saveState, saveAction, saving] = useActionState(saveTemplate, justSaved ? { message: "Saved." } : initial);
  const [testState, testAction, testing] = useActionState(sendTestEmail, initial);
  const fields = fieldsForTemplate(templateKey);

  return (
    <form action={saveAction} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_620px]">
      <Card className="flex flex-col gap-4">
        <input type="hidden" name="templateId" value={templateId ?? ""} />
        <input type="hidden" name="templateKey" value={templateKey ?? ""} />
        <label className="flex flex-col gap-1 text-xs font-extrabold text-text-muted">
          Template name {isSystem && "(automatic email — name is fixed)"}
          <input
            name="name"
            value={name}
            readOnly={isSystem}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-field border-2 border-border bg-surface px-3 py-2.5 text-sm font-bold text-text read-only:opacity-70"
          />
        </label>
        {isSystem && (
          <p className="rounded-field bg-secondary-soft px-3 py-2 text-xs font-semibold text-ink">
            Gather sends this one automatically. You can reword it; the personal fields below are filled in for each
            reminder.
          </p>
        )}
        <EmailContentEditor value={content} onChange={setContent} fields={fields} categoryLocked={isSystem} />
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-border pt-3">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </Button>
          <Button type="submit" variant="secondary" formAction={testAction} disabled={testing} formNoValidate>
            {testing ? "Sending…" : "Send test to me"}
          </Button>
          {templateId && (
            <LinkButton href={`/admin/emails/send?templateId=${templateId}`} variant="secondary">
              Use to send
            </LinkButton>
          )}
        </div>
        {(saveState.error || testState.error) && <p className="text-sm font-semibold text-primary">{saveState.error ?? testState.error}</p>}
        {(saveState.message || testState.message) && !saving && !testing && (
          <p className="text-sm font-semibold text-success">{testState.message ?? saveState.message}</p>
        )}
      </Card>
      <div className="xl:sticky xl:top-6">
        <EmailPreview content={content} vars={sampleVars(templateKey)} siteUrl={siteUrl} />
        <p className="mt-2 text-xs font-semibold text-text-muted">Preview uses sample values for the personal fields.</p>
      </div>
    </form>
  );
}
