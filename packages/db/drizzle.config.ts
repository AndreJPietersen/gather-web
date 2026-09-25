import { defineConfig } from "drizzle-kit";

// Drizzle owns the schema and generates the SQL migrations in ./migrations.
// DATABASE_URL defaults to the local Supabase stack; set it explicitly to
// migrate anything else (QA / production go through the CI migration
// pipeline, not from a laptop — see docs/gather_launch_roadmap.md, L2).
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
});
