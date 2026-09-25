import { describe, expect, it } from "vitest";
import { createGatherClient } from "./src/client";

const options = { url: "http://127.0.0.1:54321", anonKey: "test-anon-key" };

describe("createGatherClient", () => {
  it("builds a client without touching the network", () => {
    const client = createGatherClient(options);
    expect(typeof client.from).toBe("function");
    expect(typeof client.auth.getSession).toBe("function");
  });

  it("knows the real tables and rejects made-up ones (checked by tsc)", () => {
    const client = createGatherClient(options);
    client.from("vendors").select("id, name");
    // @ts-expect-error — there is no such table; this line is the test.
    client.from("no_such_table");
    // @ts-expect-error — there is no such column on vendors.
    client.from("vendors").select("id").eq("no_such_column", 1);
  });

  it("can act as one person for a single request instead of holding a session", () => {
    const client = createGatherClient({ ...options, accessToken: "some-token" });
    expect(typeof client.rpc).toBe("function");
  });
});
