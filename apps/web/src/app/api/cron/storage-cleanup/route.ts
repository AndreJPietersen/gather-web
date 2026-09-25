import { NextResponse, type NextRequest } from "next/server";
import { cleanupOrphanedStorage } from "@/lib/storage-cleanup";

// Called once a day by Vercel Cron (apps/web/vercel.json), which sends
// "Authorization: Bearer <CRON_SECRET>". With no CRON_SECRET configured the
// route refuses everything, so it can never be run by strangers.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await cleanupOrphanedStorage());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Cleanup failed" }, { status: 500 });
  }
}
