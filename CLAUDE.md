@AGENTS.md

## Standing instructions for this project

- **Andre is an expert Salesforce developer but new to this stack** (Next.js, Postgres, Supabase, Drizzle, Vercel). Whenever a new concept, tool, or pattern is introduced while working on this project, write or update a plain-language explainer in `teachAndre/` (create the folder if it's missing — it's gitignored, so check it exists locally rather than assuming from git history). One numbered file per topic, add new entries to `teachAndre/README.md`'s index. Wherever a real Salesforce equivalent exists, connect the new concept to it explicitly — that's the fastest way for it to stick. See `teachAndre/01-the-stack-overview.md` for the tone/format to match.
- **Keep `docs/` up to date as the authoritative project reference**, not just this conversation's memory. This project was migrated from a Salesforce build (`eventio` repo, a sibling folder) — a Claude Code session opened directly in *this* repo has no access to that other repo's conversation history, so `docs/gather_web_architecture.md` and any other docs added under `docs/` need to be genuinely complete and current on their own, updated as real architecture/schema/scope decisions are made, not left to go stale.
- Never create a git commit unless explicitly asked.
