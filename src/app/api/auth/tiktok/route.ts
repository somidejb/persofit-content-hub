import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIKTOK_AUTH_URL } from "@/lib/tiktok";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const SCOPES = ["user.info.basic", "video.publish"].join(",");

/**
 * GET /api/auth/tiktok
 * Redirects the user to TikTok's OAuth authorization page.
 * Requires tiktokClientKey + tiktokRedirectUri to be set in Settings.
 */
export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

  if (!settings?.tiktokClientKey) {
    return NextResponse.json(
      { error: "TikTok Client Key is not configured. Add it in Settings → TikTok Integration." },
      { status: 400 }
    );
  }

  const redirectUri = settings.tiktokRedirectUri || `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/auth/tiktok/callback`;

  // CSRF state token — stored in a short-lived cookie
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_key: settings.tiktokClientKey,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    // Without this, TikTok silently re-authorizes using whichever account
    // is already logged into the browser instead of showing the login/
    // account-picker screen — the reported "always connects the same
    // account" behavior. This forces the picker every time.
    disable_auto_auth: "1",
  });

  const authUrl = `${TIKTOK_AUTH_URL}?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  // Browsers (and some CDNs) can cache 3xx redirects by default. If a repeat
  // click ever replayed a cached response, it would carry a stale `state`
  // baked into the Location URL while a fresh cookie had already been set —
  // guaranteed "Invalid OAuth state" on the second attempt. Force no-store
  // so every click always issues a brand new state + redirect.
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.cookies.set("tiktok_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
