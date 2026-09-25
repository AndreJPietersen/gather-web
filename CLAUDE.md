@AGENTS.md

## Repository layout (monorepo since 2026-09-25)

Run commands from the repo root (`npm run typecheck | lint | test | build | e2e | dev`). The website is `apps/web` (its `@/…` alias = `apps/web/src/…`); shared TypeScript is `packages/shared` (import as `@gather/shared/<module>`); the Drizzle schema and migrations are `packages/db`; colour themes are `packages/tokens`; the Expo app will be `apps/mobile`. Env vars live in `apps/web/.env.local`. Full layout and rationale: README.md and `docs/gather_web_architecture.md`. Paths in every doc are repo-root-relative.

## Standing instructions for this project

- **Andre is an expert Salesforce developer but new to this stack** (Next.js, Postgres, Supabase, Drizzle, Vercel). Whenever a new concept, tool, or pattern is introduced while working on this project, write or update a plain-language explainer in `teachAndre/` (create the folder if it's missing — it's gitignored, so check it exists locally rather than assuming from git history). One numbered file per topic, add new entries to `teachAndre/README.md`'s index. Wherever a real Salesforce equivalent exists, connect the new concept to it explicitly — that's the fastest way for it to stick. See `teachAndre/01-the-stack-overview.md` for the tone/format to match.
- **Keep `docs/` up to date as the authoritative project reference**, not just this conversation's memory. This project was migrated from a Salesforce build (`eventio` repo, a sibling folder) — a Claude Code session opened directly in *this* repo has no access to that other repo's conversation history, so `docs/gather_web_architecture.md` and any other docs added under `docs/` need to be genuinely complete and current on their own, updated as real architecture/schema/scope decisions are made, not left to go stale.
- Never create a git commit unless explicitly asked.
- **Keep `packages/shared/src/faq-content.ts` (the `/faq` page) current as features change** — Andre's own instruction when the FAQ page was added: whenever a session changes a flow, policy, or limit an existing FAQ entry describes (payment tracking, vendor verification/chat gating, budget/vendor linking, etc.), update that entry in the same session. A stale FAQ answer is a real bug, since it's shown directly to users, not just an internal doc.
