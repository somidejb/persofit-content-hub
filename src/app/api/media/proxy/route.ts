import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxies a remote image (e.g. a Vercel Blob URL) through this app's own domain.
 * This is required for TikTok's PULL_FROM_URL flow: TikTok verifies that all
 * photo URLs belong to a domain registered in the developer console.  Since the
 * raw Blob URLs live on vercel-storage.com (a domain we don't own), we route
 * them through /api/media/proxy?url=<encoded-url> so TikTok only sees our domain.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(raw);
    new URL(targetUrl); // validate
  } catch {
    return NextResponse.json({ error: "Invalid url param" }, { status: 400 });
  }

  // Only proxy from trusted blob storage origins
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
