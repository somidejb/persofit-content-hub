import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { exchangeTikTokCode, fetchTikTokUserInfo } from "@/lib/tiktok";

function redirectAndClearState(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  // Always clear the CSRF cookie on the way out — success or failure — so a
  // failed/abandoned attempt never leaves a stale state value that could
  // collide with the next connection attempt.
  response.cookies.set("tiktok_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}

/**
 * GET /api/auth/tiktok/callback
 * TikTok redirects here after the user authorizes the app.
 * Exchanges the code for tokens and saves/updates the TiktokAccount.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user-denied or error from TikTok
  if (error) {
    const msg = searchParams.get("error_description") ?? error;
    return redirectAndClearState(new URL(`/accounts?error=${encodeURIComponent(msg)}`, req.url));
  }

  if (!code) {
    return redirectAndClearState(new URL("/accounts?error=No+authorization+code+received", req.url));
  }

  // Verify CSRF state
  const cookieState = req.cookies.get("tiktok_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return redirectAndClearState(new URL("/accounts?error=Invalid+OAuth+state", req.url));
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings?.tiktokClientKey || !settings?.tiktokClientSecret) {
    return redirectAndClearState(new URL("/accounts?error=TikTok+credentials+not+configured", req.url));
  }

  const redirectUri = settings.tiktokRedirectUri || `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/auth/tiktok/callback`;

  try {
    const tokens = await exchangeTikTokCode({
      clientKey: settings.tiktokClientKey,
      clientSecret: settings.tiktokClientSecret,
      code,
      redirectUri,
    });

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // Best-effort — a hiccup fetching profile info shouldn't block connecting
    // the account; it'll just keep the placeholder name until next refresh.
    let displayName: string | null = null;
    let avatarUrl: string | null = null;
    try {
      const info = await fetchTikTokUserInfo(tokens.accessToken);
      displayName = info.displayName;
      avatarUrl = info.avatarUrl;
    } catch (err) {
      console.error("[tiktok oauth] failed to fetch user info:", err);
    }

    // Upsert by TikTok openId — update if already connected, create if new
    const existing = await prisma.tiktokAccount.findFirst({
      where: { accountId: tokens.openId },
    });

    if (existing) {
      await prisma.tiktokAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: expiresAt,
          connected: true,
          ...(displayName ? { name: displayName } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        },
      });
    } else {
      await prisma.tiktokAccount.create({
        data: {
          name: displayName ?? `TikTok (${tokens.openId.slice(0, 8)}…)`,
          accountId: tokens.openId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: expiresAt,
          avatarUrl,
          connected: true,
        },
      });
    }

    return redirectAndClearState(new URL("/accounts?connected=1", req.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return redirectAndClearState(new URL(`/accounts?error=${encodeURIComponent(msg)}`, req.url));
  }
}
