"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EmailTemplateContent } from "@gather/shared/email/layout";
import { firstNameOf, STANDARD_FIELDS } from "@gather/shared/email/fields";
import { cn } from "@gather/shared/utils";
import { previewAudience, sendAdminEmail, sendTestEmail, type AudiencePreview, type EmailActionState } from "../actions";
import { EmailContentEditor, EmailPreview } from "../email-content-editor";

interface TemplateOption {
  id: string;
  name: string;
  content: EmailTemplateContent;
}
interface Person {
  id: string;
  email: string;
  name: string | null;
}

const control = "w-full rounded-field border-2 border-border bg-surface px-3 py-2.5 text-sm font-semibold text-text";
const label = "flex flex-col gap-1 text-xs font-extrabold text-text-muted";
const BLANK: EmailTemplateContent = {
  category: "transactional",
  subject: "",
  preheader: "",
  heading: "Hi {{first_name}}",
  body: "",
  buttonLabel: "",
  buttonUrl: "",
  useRawHtml: false,
  rawHtml: "",
};

type AudienceType = "user" | "segment" | "addresses";

export function SendEmailForm({
  templates,
  people,
  vendors,
  initialTemplateId,
  initialUserId,
  initialVendorId,
  siteUrl,
}: {
  templates: TemplateOption[];
  people: Person[];
  vendors: { id: string; name: string }[];
  initialTemplateId: string | null;
  initialUserId: string | null;
  initialVendorId: string | null;
  siteUrl: string;
}) {
  // Blank unless a template was picked (e.g. "Use to send" on a template).
  const startTemplate = templates.find((t) => t.id === initialTemplateId);
  const [templateId, setTemplateId] = useState(startTemplate?.id ?? "");
  const [content, setContent] = useState<EmailTemplateContent>(startTemplate?.content ?? BLANK);

  const [audienceType, setAudienceType] = useState<AudienceType>(initialVendorId ? "segment" : "user");
  const [segment, setSegment] = useState(initialVendorId ? "vendor_team" : "everyone");
  const [vendorId, setVendorId] = useState(initialVendorId ?? "");
  const [days, setDays] = useState("30");
  const [addresses, setAddresses] = useState("");
  const initialPerson = people.find((p) => p.id === initialUserId);
  const [personQuery, setPersonQuery] = useState(initialPerson ? personLabel(initialPerson) : "");
  // Controlled on purpose: React resets uncontrolled fields after every
  // server action on this form (Check recipients, Send test, a refused
  // Send), which would wipe a typed "SEND".
  const [confirm, setConfirm] = useState("");
  const person = people.find((p) => personLabel(p) === personQuery);

  const [preview, previewAction, checking] = useActionState(previewAudience, {} as AudiencePreview);
  const [sendState, sendAction, sending] = useActionState(sendAdminEmail, {} as EmailActionState);
  const [testState, testAction, testing] = useActionState(sendTestEmail, {} as EmailActionState);

  const previewVars = useMemo(() => {
    const who = audienceType === "user" && person ? person : null;
    const name = who?.name ?? preview.sampleName ?? null;
    return {
      first_name: firstNameOf(name),
      name: name ?? "",
      email: who?.email ?? preview.sampleEmail ?? "someone@example.com",
    };
  }, [audienceType, person, preview.sampleName, preview.sampleEmail]);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    setContent(t ? t.content : BLANK);
  }

  const tab = (t: AudienceType, text: string) => (
    <button
      type="button"
      onClick={() => setAudienceType(t)}
      className={cn("rounded-pill px-3 py-1.5 text-xs font-extrabold", audienceType === t ? "bg-primary text-white" : "bg-bg text-text-muted")}
    >
      {text}
    </button>
  );

  return (
    <form action={sendAction} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_620px]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <p className="font-display text-lg font-semibold text-ink">1. Who gets it</p>
          <div className="flex flex-wrap gap-2">
            {tab("user", "One person")}
            {tab("segment", "A group or everyone")}
            {tab("addresses", "Email addresses")}
          </div>
          <input type="hidden" name="audienceType" value={audienceType} />
          {audienceType === "user" && (
            <label className={label}>
              Person (type a name or email)
              <input list="people" value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} className={control} />
              <datalist id="people">
                {people.map((p) => (
                  <option key={p.id} value={personLabel(p)} />
                ))}
              </datalist>
              <input type="hidden" name="userId" value={person?.id ?? ""} />
              {personQuery && !person && <span className="font-semibold text-primary">Pick someone from the list.</span>}
            </label>
          )}
          {audienceType === "segment" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className={label}>
                Group
                <select name="segment" value={segment} onChange={(e) => setSegment(e.target.value)} className={control}>
                  <option value="everyone">Everyone</option>
                  <option value="planners">All planners (no vendor business)</option>
                  <option value="vendor_owners">All vendor owners</option>
                  <option value="vendor_team">One business&apos;s whole team</option>
                  <option value="new_users">People who joined recently</option>
                </select>
              </label>
              {segment === "vendor_team" && (
                <label className={label}>
                  Business
                  <select name="vendorId" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={control}>
                    <option value="">Choose a business…</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {segment === "new_users" && (
                <label className={label}>
                  Joined in the last … days
                  <input name="days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className={control} />
                </label>
              )}
            </div>
          )}
          {audienceType === "addresses" && (
            <label className={label}>
              Email addresses (comma, space or one per line) — they don&apos;t need a Gather account
              <textarea name="addresses" rows={3} value={addresses} onChange={(e) => setAddresses(e.target.value)} className={control} />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary" formAction={previewAction} formNoValidate disabled={checking}>
              {checking ? "Checking…" : "Check recipients"}
            </Button>
            {preview.error && <p className="text-sm font-semibold text-primary">{preview.error}</p>}
            {preview.count !== undefined && !preview.error && (
              <p className="text-sm font-bold text-text">
                {preview.count} {preview.count === 1 ? "person" : "people"}
                {content.category === "announcement" && (preview.suppressed ?? 0) > 0 && ` · ${preview.suppressed} unsubscribed, will be skipped`}
              </p>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <p className="font-display text-lg font-semibold text-ink">2. The email</p>
          <label className={label}>
            Start from a template
            <select value={templateId} onChange={(e) => chooseTemplate(e.target.value)} className={control}>
              <option value="">Blank email</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="font-semibold">Changes here only affect this send — the template itself isn&apos;t changed.</span>
          </label>
          <input type="hidden" name="templateId" value={templateId} />
          <EmailContentEditor value={content} onChange={setContent} fields={STANDARD_FIELDS} />
        </Card>

        <Card className="flex flex-col gap-3">
          <p className="font-display text-lg font-semibold text-ink">3. Send</p>
          <label className={label}>
            Sending to more than one person? Type SEND to confirm
            <input
              name="confirm"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={cn(control, "max-w-40 uppercase")}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" disabled={sending}>
              {sending ? "Sending…" : "Send email"}
            </Button>
            <Button type="submit" variant="secondary" formAction={testAction} formNoValidate disabled={testing}>
              {testing ? "Sending…" : "Send test to me"}
            </Button>
          </div>
          {(sendState.error || testState.error) && <p className="text-sm font-semibold text-primary">{sendState.error ?? testState.error}</p>}
          {(sendState.message || testState.message) && <p className="text-sm font-semibold text-success">{testState.message ?? sendState.message}</p>}
        </Card>
      </div>

      <div className="xl:sticky xl:top-6">
        <EmailPreview content={content} vars={previewVars} siteUrl={siteUrl} />
        <p className="mt-2 text-xs font-semibold text-text-muted">
          Preview personalised for {previewVars.email === "someone@example.com" ? "a sample person — check recipients to see a real one" : previewVars.email}.
        </p>
      </div>
    </form>
  );
}

function personLabel(p: Person): string {
  return p.name ? `${p.name} — ${p.email}` : p.email;
}
