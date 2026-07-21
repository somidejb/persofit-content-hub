import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * TikTok URL prefix ownership verification endpoint.
 * TikTok GETs this path to confirm we own the /api/media/proxy/ prefix.
 * Set TIKTOK_SITE_VERIFICATION in your Vercel env vars to the signature
 * string shown in the TikTok developer console when adding the URL prefix.
 */
export async function GET() {
  const sig = process.env.TIKTOK_SITE_VERIFICATION;
  if (!sig) {
    return new NextResponse("TIKTOK_SITE_VERIFICATION env var not set", { status: 404 });
  }
  return new NextResponse(sig, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
