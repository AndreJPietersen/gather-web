import { describe, expect, it } from "vitest";
import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "./unsubscribe";

const SITE = "https://gather.example";

describe("unsubscribe tokens", () => {
  it("round-trips and rejects tampering", () => {
    const t = unsubscribeToken("Thandi@Example.com");
    expect(verifyUnsubscribeToken("thandi@example.com", t)).toBe(true);
    expect(verifyUnsubscribeToken("someone@else.com", t)).toBe(false);
    expect(verifyUnsubscribeToken("thandi@example.com", t.slice(0, -1) + "x")).toBe(false);
    expect(unsubscribeUrl(SITE, "A@B.com")).toMatch(/^https:\/\/gather\.example\/unsubscribe\?e=a%40b\.com&t=/);
  });
});
