import { NextResponse } from "next/server";
import { callerFromBearer, type Caller } from "@/server/context";
import { fail, type ServiceResult } from "@/server/result";

// Glue for the /api/v1 route handlers. Every response has one of two shapes:
//   success  { "data": ... }
//   failure  { "error": { "code": "...", "message": "...", "details"?: {...} } }
// with a matching HTTP status. `message` is written for the person using the
// app and is safe to show as is; `code` is for the app's own logic.

async function readBody(request: Request): Promise<{ body: unknown } | { error: ServiceResult<never> }> {
  if (request.method === "GET" || request.method === "HEAD") return { body: undefined };
  const text = await request.text();
  if (!text) return { body: {} };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: fail(400, "invalid_json", "The request body must be valid JSON.") };
  }
}

function respond<T>(result: ServiceResult<T>, successStatus: number): NextResponse {
  if (result.ok) {
    return NextResponse.json({ data: result.data ?? null }, { status: successStatus });
  }
  return NextResponse.json(
    { error: { code: result.code, message: result.message, ...(result.details ? { details: result.details } : {}) } },
    { status: result.status },
  );
}

async function run<T>(request: Request, fn: (body: unknown) => Promise<ServiceResult<T>>, successStatus: number) {
  const read = await readBody(request);
  if ("error" in read) return respond(read.error, 400);
  try {
    return respond(await fn(read.body), successStatus);
  } catch (e) {
    console.error("api v1 error", e);
    return respond(fail(500, "server_error", "Something went wrong on our side. Please try again."), 500);
  }
}

/** An endpoint that needs a signed-in caller (Bearer token). */
export function authed<T>(request: Request, fn: (caller: Caller, body: unknown) => Promise<ServiceResult<T>>, successStatus = 200) {
  return run(
    request,
    async (body) => {
      const caller = await callerFromBearer(request);
      if (!caller) return fail(401, "unauthenticated", "Missing or invalid access token.");
      return fn(caller, body);
    },
    successStatus,
  );
}

/** An endpoint anyone may call (guest RSVP). */
export function open<T>(request: Request, fn: (body: unknown) => Promise<ServiceResult<T>>, successStatus = 200) {
  return run(request, fn, successStatus);
}
