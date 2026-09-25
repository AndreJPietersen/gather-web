import { describe, expect, it } from "vitest";
import { escapeHtml, fieldsUsed, mergeFields, safeUrl } from "./merge";
import { blocksToHtml, sanitizeEmailHtml } from "./body";
import { renderEmail, type EmailTemplateContent } from "./layout";
import { firstNameOf, SYSTEM_TEMPLATE_DEFAULTS } from "./fields";

const SITE = "https://gather.example";

describe("merge fields", () => {
  it("escapes values in HTML and leaves unknown fields visible", () => {
    expect(mergeFields("Hi {{first_name}} {{frist_name}}", { first_name: "<b>Tom & Co</b>" }, true)).toBe(
      "Hi &lt;b&gt;Tom &amp; Co&lt;/b&gt; {{frist_name}}",
    );
  });
  it("keeps plain text for subjects", () => {
    expect(mergeFields("Hi {{ first_name }}", { first_name: "Tom & Co" }, false)).toBe("Hi Tom & Co");
  });
  it("lists the fields a template uses", () => {
    expect(fieldsUsed("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
  it("only allows web links", () => {
    expect(safeUrl("/events/new", SITE)).toBe("https://gather.example/events/new");
    expect(safeUrl("https://x.com", SITE)).toBe("https://x.com");
    expect(safeUrl("javascript:alert(1)", SITE)).toBeNull();
  });
  it("escapes everything", () => {
    expect(escapeHtml(`<"'&>`)).toBe("&lt;&quot;&#39;&amp;&gt;");
  });
});

describe("blocks body", () => {
  it("builds paragraphs, bold, links and lists", () => {
    const html = blocksToHtml("Hi **{{first_name}}**\nline two\n\n- one\n- two\n\nSee [the site](/vendors).", { first_name: "Thandi" }, SITE);
    expect(html).toContain("<strong>Thandi</strong><br>line two");
    expect(html).toMatch(/<ul[^>]*><li[^>]*>one<\/li><li[^>]*>two<\/li><\/ul>/);
    expect(html).toContain('href="https://gather.example/vendors"');
  });
  it("never turns typed or merged text into HTML", () => {
    const html = blocksToHtml("<img src=x onerror=alert(1)> {{name}}", { name: "<script>x</script>" }, SITE);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
  });
  it("drops unsafe markdown links", () => {
    expect(blocksToHtml("[click](javascript:alert(1))", {}, SITE)).not.toContain("javascript:");
  });
});

describe("raw HTML sanitising", () => {
  it("strips scripts, frames, handlers and javascript: links", () => {
    const out = sanitizeEmailHtml(`<p onclick="x()">Hi</p><script>bad()</script><iframe src="x"></iframe><a href="javascript:bad()">l</a>`);
    expect(out).toBe(`<p>Hi</p><a href="#">l</a>`);
  });
});

describe("renderEmail", () => {
  const base: EmailTemplateContent = {
    category: "transactional",
    subject: "Hello {{first_name}}",
    preheader: "Preview",
    heading: "Welcome, {{first_name}}",
    body: "Body text",
    buttonLabel: "Open Gather",
    buttonUrl: "/",
    useRawHtml: false,
    rawHtml: null,
  };
  it("renders subject, heading, body, button and footer", () => {
    const r = renderEmail(base, { first_name: "Thandi" }, { siteUrl: SITE, footerNote: "Why you got this" });
    expect(r.subject).toBe("Hello Thandi");
    expect(r.html).toContain("Welcome, Thandi");
    expect(r.html).toContain("Open Gather");
    expect(r.html).toContain(`${SITE}/icon-512.png`);
    expect(r.html).toContain("Why you got this");
    expect(r.html).not.toContain("Unsubscribe");
    expect(r.text).toContain("Open Gather: https://gather.example/");
  });
  it("adds the unsubscribe link only to announcements", () => {
    const r = renderEmail({ ...base, category: "announcement" }, {}, { siteUrl: SITE, unsubscribeUrl: `${SITE}/unsubscribe?x` });
    expect(r.html).toContain("Unsubscribe from Gather announcements");
  });
  it("uses raw HTML when chosen, without the button", () => {
    const r = renderEmail({ ...base, useRawHtml: true, rawHtml: "<p>Custom {{first_name}}</p>" }, { first_name: "T" }, { siteUrl: SITE });
    expect(r.html).toContain("<p>Custom T</p>");
    expect(r.html).not.toContain("Open Gather");
  });
  it("renders every system template with its sample values", () => {
    for (const t of Object.values(SYSTEM_TEMPLATE_DEFAULTS)) {
      const r = renderEmail(t, { first_name: "T", amount: "R1", vendor_name: "V", event_name: "E", due_date: "D", task_title: "X", link: "/x" }, { siteUrl: SITE });
      expect(r.html).not.toMatch(/\{\{/);
    }
  });
});

describe("firstNameOf", () => {
  it("falls back politely", () => {
    expect(firstNameOf("Thandi Mokoena")).toBe("Thandi");
    expect(firstNameOf(null)).toBe("there");
  });
});
