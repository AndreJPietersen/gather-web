This is Gather's web frontend, a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). See `docs/gather_web_architecture.md` for the full architecture, data model, and build sequencing — this project was migrated from an earlier Salesforce build, and `docs/` is the authoritative, kept-current reference going forward (a Claude Code session started in this repo has no memory of the Salesforce-side conversations, so these docs have to stand on their own).

If you're new to this stack, `teachAndre/` (gitignored, not part of the shipped project) has plain-language write-ups of every tool/concept as it's introduced, aimed at someone who knows Salesforce well but not this stack.

## One-time local setup (Docker + Supabase)

This project uses the [Supabase CLI](https://supabase.com/docs/guides/local-development) to run a full local Postgres + Auth + Storage stack in Docker, mirroring production. Docker Desktop requires WSL2 and Administrator privileges to install, so do this part yourself in an **elevated PowerShell** (right-click PowerShell/Terminal -> Run as administrator):

```powershell
# 1. Install WSL2 (reboot when it asks)
wsl --install

# 2. After rebooting, back in an elevated PowerShell:
winget install -e --id Docker.DockerDesktop
```

Then launch Docker Desktop once from the Start menu and let it finish its first-run setup (it defaults to the WSL2 backend). After that, back in a normal (non-admin) terminal in this project folder:

```bash
npm run db:start   # supabase start -- pulls images the first time, then boots local Postgres/Auth/Storage
```

`supabase start` prints a local API URL, anon key, service role key, and DB connection string — copy those into `.env.local` (copy `.env.example` to `.env.local` first). Stop the stack later with `npm run db:stop`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing on a real phone (this is a mobile-first app)

Run `npm run dev:mobile` instead (binds to all network interfaces), find your PC's local IP (`ipconfig`, look under your Wi-Fi adapter), then visit `http://<that-ip>:3000` from a phone on the same Wi-Fi. If that's blocked (cellular data, a locked-down network, or a flow needing real HTTPS) use a tunnel like Cloudflare Tunnel or ngrok to get a public `https://` URL to your local server instead.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
