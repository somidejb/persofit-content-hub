import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Handles GET /api/media/proxy/[base64url-encoded-blob-url]
 * The encoded segment is a base64url-encoded Vercel Blob HTTPS URL.
 * This path-based format is required so TikTok's prefix matching works:
 *   verified prefix : https://domain/api/media/proxy/
 *   our proxy URL   : https://domain/api/media/proxy/aHR0cHM6Ly94...  ✓
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { encoded: string } }
) {
  let targetUrl: string;
  try {
    targetUrl = Buffer.from(params.encoded, "base64url").toString("utf8");
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid encoded URL" }, { status: 400 });
  }

  // Only proxy from trusted Vercel Blob origins
  const allowed = ["blob.vercel-storage.com", "public.blob.vercel-storage.com"];
  const host = new URL(targetUrl).hostname;
  if (!allowed.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const upstream = await fetch(targetUrl);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream fetch failed: ${upstream.status}` },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "Content-Length": String(body.byteLength),
    },
  });
}
