// What every service function returns. The website's Server Actions and the
// native apps' /api/v1 endpoints both call the same services, so a rule lives
// in one place and both callers get the same answer; each just presents it
// its own way (the action turns it into form state or a redirect, the route
// into JSON with an HTTP status).
export type ServiceResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

export function ok<T>(data: T): ServiceResult<T>;
export function ok(): ServiceResult<undefined>;
export function ok<T>(data?: T): ServiceResult<T | undefined> {
  return { ok: true, data };
}

export function fail(status: number, code: string, message: string, details?: Record<string, unknown>): ServiceResult<never> {
  return { ok: false, status, code, message, details };
}

/** Input that failed validation: the first problem, in words a person can act on. */
export function invalid(issue: string | undefined, fallback = "Please check your details."): ServiceResult<never> {
  return fail(400, "validation_error", issue ?? fallback);
}

export const unauthenticated = () => fail(401, "unauthenticated", "Your session expired — please log in again.");
