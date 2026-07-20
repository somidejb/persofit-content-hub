import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshTikTokToken } from "@/lib/tiktok";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const account = await prisma.tiktokAccount.findUnique({ where: { id: params.id } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  if (!account.refreshToken) {
    return NextResponse.json(
      { error: "No refresh token stored. Re-connect this account via TikTok OAuth." },
      { status: 400 }
    );
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings?.tiktokClientKey || !settings?.tiktokClientSecret) {
    return NextResponse.json(
      { error: "TikTok Client Key / Secret not configured in Settings." },
      { status: 400 }
    );
  }

  try {
    const tokens = await refreshTikTokToken({
      clientKey: settings.tiktokClientKey,
      clientSecret: settings.tiktokClientSecret,
      refreshToken: account.refreshToken,
    });

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    await prisma.tiktokAccount.update({
      where: { id: account.id },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        connected: true,
      },
    });

    return NextResponse.json({ ok: true, expiresAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    await prisma.tiktokAccount.update({
      where: { id: account.id },
      data: { connected: false },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
