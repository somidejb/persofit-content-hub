export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { scanForOrphanedBlobs, deleteBlobs } from "@/lib/blob-cleanup";

/** GET — read-only dry run. Lists what's orphaned without deleting anything. */
export async function GET() {
  try {
    const report = await scanForOrphanedBlobs();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}

/** POST — deletes exactly the URLs passed in (from a GET dry run the user reviewed). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const urls = Array.isArray(body.urls) ? (body.urls as unknown[]).filter((u): u is string => typeof u === "string") : [];

  if (urls.length === 0) {
    return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
  }

  try {
    const result = await deleteBlobs(urls);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
