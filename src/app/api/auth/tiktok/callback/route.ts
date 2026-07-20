import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeTikTokCode } from "@/lib/tiktok";

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
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(msg)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/accounts?error=No+authorization+code+received", req.url));
  }

  // Verify CSRF state
  const cookieState = req.cookies.get("tiktok_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL("/accounts?error=Invalid+OAuth+state", req.url));
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings?.tiktokClientKey || !settings?.tiktokClientSecret) {
    return NextResponse.redirect(new URL("/accounts?error=TikTok+credentials+not+configured", req.url));
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
        },
      });
    } else {
      await prisma.tiktokAccount.create({
        data: {
          name: `TikTok (${tokens.openId.slice(0, 8)}…)`,
          accountId: tokens.openId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: expiresAt,
          connected: true,
        },
      });
    }

    const response = NextResponse.redirect(new URL("/accounts?connected=1", req.url));
    // Clear the CSRF cookie
    response.cookies.set("tiktok_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
