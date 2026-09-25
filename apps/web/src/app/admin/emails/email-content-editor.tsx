"use client";

import { useMemo, useRef } from "react";
import { renderEmail, type EmailTemplateContent } from "@/lib/email/layout";
import type { MergeField } from "@/lib/email/fields";
import type { MergeVars } from "@/lib/email/merge";
import { cn } from "@/lib/utils";

// The shared "blocks + HTML" editor used by the template editor and the send
// page. Fully controlled: the parent owns the content and posts it via the
// hidden inputs rendered here (so the same fields reach contentFromForm()).

const control = "w-full rounded-field border-2 border-border bg-surface px-3 py-2.5 text-sm font-semibold text-text";
const label = "flex flex-col gap-1 text-xs font-extrabold text-text-muted";

type Focusable = HTMLInputElement | HTMLTextAreaElement;

export function EmailContentEditor({
  value,
  onChange,
  fields,
  categoryLocked = false,
}: {
  value: EmailTemplateContent;
  onChange: (next: EmailTemplateContent) => void;
  fields: MergeField[];
  categoryLocked?: boolean;
}) {
  // Where a merge-field chip inserts: the last text box that had focus.
  const lastFocused = useRef<{ el: Focusable; key: keyof EmailTemplateContent } | null>(null);
  const set = <K extends keyof EmailTemplateContent>(key: K, v: EmailTemplateContent[K]) => onChange({ ...value, [key]: v });

  // One handler for every text box; data-field says which content key it
  // edits (a per-field closure built during render trips the refs lint rule).
  function rememberFocus(e: React.FocusEvent<Focusable>) {
    const key = e.currentTarget.dataset.field as keyof EmailTemplateContent | undefined;
    if (key) lastFocused.current = { el: e.currentTarget, key };
  }

  function insertField(fieldKey: string) {
    const token = `{{${fieldKey}}}`;
    const target = lastFocused.current ?? null;
    const key = target?.key ?? (value.useRawHtml ? "rawHtml" : "body");
    const current = String(value[key] ?? "");
    const start = target?.el.selectionStart ?? current.length;
    const end = target?.el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    onChange({ ...value, [key]: next });
    requestAnimationFrame(() => {
      if (!target) return;
      target.el.focus();
      target.el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className={label}>
        Type
        <select
          value={value.category}
          disabled={categoryLocked}
          onChange={(e) => set("category", e.target.value as EmailTemplateContent["category"])}
          className={control}
        >
          <option value="transactional">Direct / transactional — always delivered</option>
          <option value="announcement">Announcement — includes an unsubscribe link, skips people who opted out</option>
        </select>
      </label>
      <label className={label}>
        Subject
        <input value={value.subject} onChange={(e) => set("subject", e.target.value)} data-field="subject" onFocus={rememberFocus} className={control} required />
      </label>
      <label className={label}>
        Preview text (shown after the subject in most inboxes)
        <input value={value.preheader ?? ""} onChange={(e) => set("preheader", e.target.value)} data-field="preheader" onFocus={rememberFocus} className={control} />
      </label>

      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold text-text-muted">Content</p>
        <div className="flex rounded-pill border-2 border-border p-0.5 text-xs font-extrabold">
          {[
            { raw: false, text: "Blocks" },
            { raw: true, text: "HTML" },
          ].map((m) => (
            <button
              key={m.text}
              type="button"
              onClick={() => set("useRawHtml", m.raw)}
              className={cn("rounded-pill px-3 py-1", value.useRawHtml === m.raw ? "bg-primary text-white" : "text-text-muted")}
            >
              {m.text}
            </button>
          ))}
        </div>
      </div>

      {value.useRawHtml ? (
        <label className={label}>
          HTML inside the Gather card (header, footer and styling stay fixed)
          <textarea
            value={value.rawHtml ?? ""}
            onChange={(e) => set("rawHtml", e.target.value)}
            data-field="rawHtml" onFocus={rememberFocus}
            rows={16}
            spellCheck={false}
            className={cn(control, "font-mono text-xs")}
            placeholder={'<h1 style="margin:0 0 16px;">Hello {{first_name}}</h1>\n<p>...</p>'}
          />
        </label>
      ) : (
        <>
          <label className={label}>
            Heading
            <input value={value.heading ?? ""} onChange={(e) => set("heading", e.target.value)} data-field="heading" onFocus={rememberFocus} className={control} />
          </label>
          <label className={label}>
            Body
            <textarea
              value={value.body ?? ""}
              onChange={(e) => set("body", e.target.value)}
              data-field="body" onFocus={rememberFocus}
              rows={10}
              className={control}
            />
            <span className="font-semibold">
              Blank line = new paragraph · **bold** · [link text](https://…) · start lines with “- ” for a list
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Button text (optional)
              <input value={value.buttonLabel ?? ""} onChange={(e) => set("buttonLabel", e.target.value)} data-field="buttonLabel" onFocus={rememberFocus} className={control} />
            </label>
            <label className={label}>
              Button link
              <input
                value={value.buttonUrl ?? ""}
                onChange={(e) => set("buttonUrl", e.target.value)}
                data-field="buttonUrl" onFocus={rememberFocus}
                placeholder="/events/new or https://…"
                className={control}
              />
            </label>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-extrabold text-text-muted">Insert a personal field</p>
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => insertField(f.key)}
              title={`Inserts {{${f.key}}} — e.g. "${f.sample}"`}
              className="rounded-pill border-2 border-border bg-surface px-2.5 py-1 text-xs font-bold text-text hover:border-primary"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* What the server actions read. */}
      <input type="hidden" name="category" value={value.category} />
      <input type="hidden" name="subject" value={value.subject} />
      <input type="hidden" name="preheader" value={value.preheader ?? ""} />
      <input type="hidden" name="heading" value={value.heading ?? ""} />
      <input type="hidden" name="body" value={value.body ?? ""} />
      <input type="hidden" name="buttonLabel" value={value.buttonLabel ?? ""} />
      <input type="hidden" name="buttonUrl" value={value.buttonUrl ?? ""} />
      <input type="hidden" name="useRawHtml" value={value.useRawHtml ? "true" : "false"} />
      <input type="hidden" name="rawHtml" value={value.rawHtml ?? ""} />
    </div>
  );
}

// Live preview — the real renderer, in a sandboxed iframe (no scripts, no
// same-origin access), so what you see is exactly what gets sent.
export function EmailPreview({ content, vars, siteUrl }: { content: EmailTemplateContent; vars: MergeVars; siteUrl: string }) {
  const rendered = useMemo(
    () =>
      renderEmail(content, vars, {
        siteUrl,
        unsubscribeUrl: `${siteUrl}/unsubscribe`,
        footerNote: "You're receiving this because you have a Gather account.",
      }),
    [content, vars, siteUrl],
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-field border-2 border-border bg-surface px-3 py-2">
        <p className="truncate text-sm font-extrabold text-ink">{rendered.subject}</p>
        <p className="truncate text-xs font-semibold text-text-muted">{content.preheader || "No preview text"}</p>
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={rendered.html}
        className="h-[720px] w-full rounded-[18px] border-2 border-border bg-white"
      />
    </div>
  );
}
