# Gather API v1 (for the native apps)

The apps talk to **Supabase directly** for everything that is a plain row-level-security-protected read or write (events, guests, tasks, budget, quotes, chat, profile, reviews, claims…). This API covers only what a phone can't do that way: things that need the **service role** or several steps of server logic. It lives in `apps/web/src/app/api/v1/**` and shares its code with the website's Server Actions (`apps/web/src/server/`), so both enforce exactly the same rules. Salesforce parallel: a thin `@RestResource` layer over the same Apex service classes the Lightning controllers call.

## Conventions

- **Base URL**: `<site>/api/v1` (`http://localhost:3000/api/v1` locally).
- **Auth**: `Authorization: Bearer <Supabase access token>` — the `access_token` from `supabase.auth` on the device. The server asks the auth server about the token on every call, so a suspended or deleted account's token stops working immediately. **`POST /events/{id}/rsvp` needs no token** (guests have no account).
- **Bodies** are JSON. Path parameters win over the same name in the body.
- **Success**: `{ "data": … }` with 200 (or 201 for creates).
- **Failure**: `{ "error": { "code": "…", "message": "…", "details"?: {…} } }` with a matching HTTP status. `message` is written for people and safe to show as is; `code` is for the app's logic. Common codes: `unauthenticated` (401), `validation_error` (400), `invalid_json` (400), `not_found` (404), `server_error` (500).
- **Rate limits**: authenticated writes hit the same database triggers as the website (per-person hourly limits, daily listing cap), reported as a friendly message. The unauthenticated RSVP endpoint has **no per-IP limit yet** (same as the website today) — that needs Cloudflare/Vercel in front of it (account) and is tracked in the roadmap.
- **Admin functions are not exposed** here at all.

## Endpoints

| Method & path | Who | Body | Notes |
|---|---|---|---|
| `GET /me` | any signed-in user | — | `{ id, email, displayName }`. Also a "is my token still good?" check. |
| `DELETE /me` | the person | `{ "confirm": "DELETE" }` | Permanently deletes the account (see `delete_account`, architecture doc). 409 `admin_account` for admins. |
| `POST /events/{id}/rsvp` | **anyone** | `{ name, email, phone?, guestCount }` | 201. 404 `not_accepting_rsvps` unless the event is published and public. |
| `POST /events/{id}/collaborators` | event owner / accepted editor | `{ email, permissionLevel: "editor"\|"viewer" }` | 201. 404 `no_such_account`; 409 `invite_failed` (not allowed, or already invited). |
| `POST /vendors` | signed-in user | `{ name, primaryCategory, description?, phone?, website? }` | 201 `{ vendorId }`; caller becomes its Owner. 409 `business_rules_blocked` with `details.blocked` (`overLimit`, `duplicateCategory`, `hasPendingRequest`…) when an owner rule applies; 429 `daily_limit`. |
| `PATCH /vendors/{id}` | owner / manager | `{ name, primaryCategory?, description?, phone?, website? }` | 409 `category_clash` when re-categorising would break the one-per-category rule; 403 `update_failed` when not allowed. |
| `POST /business-requests` | signed-in user | `{ name, primaryCategory, reason }` | 201. Asks an admin to allow a business the rules block. 409 `not_needed` / `already_pending`. |
| `POST /vendors/{id}/featured-requests` | business **owner** | `{ spot: "top"\|"rotating", duration: "1_week"\|"1_month"\|"3_months", startsOn: "YYYY-MM-DD", vendorNote? }` | 201. Creates a *pending* placement; nothing goes live until an admin activates it. 403 `not_owner`; 409 `featured_off` / `already_pending`. |
| `DELETE /vendors/{id}/featured-requests/{placementId}` | business **owner** | — | Withdraws a pending request. 404 `not_found` if nothing pending. |
| `POST /reminders/check` | signed-in user | — | Sends the caller's due payment/task reminder emails (each at most once). Push notifications (L8) will replace this for the apps. |

## Adding an endpoint

1. Put the rule in a service function in `apps/web/src/server/services/*.ts` — `(caller, input: unknown) => ServiceResult`, validating with zod inside. Use `caller.supabase` for anything RLS should govern; call `createServiceClient()` only after checking the caller.
2. Website: a Server Action that builds `input` from `FormData`, calls the service and turns the result into form state / redirect / `revalidatePath`.
3. API: a route file under `app/api/v1/…` using `authed()` (or `open()` for public endpoints) from `@/server/api`.
4. Add checks to `e2e/scripts/api-v1.mjs`: no token, bad token, wrong person, right person.
5. Add it to the table above.

## Not in the API on purpose

Anything RLS already protects is called directly through Supabase (see the table in `docs/gather_launch_roadmap.md`, "How the native apps reach the data"). File uploads go straight to Storage with the user's own token. Unsubscribe stays a web page (it is opened from an email).
