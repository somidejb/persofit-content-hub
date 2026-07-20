import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "./prisma";
import { postPhotoSlideshow, refreshTikTokToken, TikTokApiError } from "./tiktok";

/** Returns a valid access token for the account, auto-refreshing if expired */
async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await prisma.tiktokAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("TikTok account not found");

  // Token is still valid (with 5-minute buffer)
  const bufferMs = 5 * 60 * 1000;
  if (!account.tokenExpiresAt || account.tokenExpiresAt.getTime() - Date.now() > bufferMs) {
    return account.accessToken;
  }

  // Token expired — try to refresh
  if (!account.refreshToken) {
    throw new Error(
      `TikTok token for "${account.name}" has expired and no refresh token is stored. ` +
      "Re-connect this account via the TikTok OAuth button on the Accounts page."
    );
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings?.tiktokClientKey || !settings?.tiktokClientSecret) {
    throw new Error(
      "TikTok token has expired but Client Key / Secret are not configured in Settings. " +
      "Add them to enable auto-refresh."
    );
  }

  const tokens = await refreshTikTokToken({
    clientKey: settings.tiktokClientKey,
    clientSecret: settings.tiktokClientSecret,
    refreshToken: account.refreshToken,
  });

  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  await prisma.tiktokAccount.update({
    where: { id: accountId },
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: expiresAt,
      connected: true,
    },
  });

  return tokens.accessToken;
}

export async function postSlideshowNow(slideshowId: string) {
  const slideshow = await prisma.slideshow.findUnique({
    where: { id: slideshowId },
    include: { slides: { orderBy: { order: "asc" } }, tiktokAccount: true },
  });

  if (!slideshow) throw new Error("Slideshow not found");
  if (!slideshow.tiktokAccount) throw new Error("No TikTok account assigned to this slideshow");

  const missing = slideshow.slides.filter((s) => !s.finalImagePath);
  if (missing.length > 0) throw new Error("Not all slides have a finished image with the text overlay baked in yet");

  const imagePaths = slideshow.slides.map((s) => s.finalImagePath as string);

  try {
    const accessToken = await getValidAccessToken(slideshow.tiktokAccount.id);

    const images = await Promise.all(
      imagePaths.map(async (p) => {
        if (p.startsWith("http://") || p.startsWith("https://")) {
          const res = await fetch(p);
          if (!res.ok) throw new Error(`Failed to fetch image from blob: ${p}`);
          return Buffer.from(await res.arrayBuffer());
        }
        return readFile(path.join(process.cwd(), "public", p.replace(/^\//, "")));
      })
    );

    const { publishId } = await postPhotoSlideshow({
      accessToken,
      images,
      caption: slideshow.caption,
      hashtags: slideshow.hashtags,
      musicId: slideshow.tiktokMusicId ?? undefined,
    });

    await prisma.postHistory.create({
      data: {
        slideshowId: slideshow.id,
        tiktokAccountId: slideshow.tiktokAccount.id,
        status: "posted",
        generatedImages: JSON.stringify(imagePaths),
      },
    });
    await prisma.slideshow.update({ where: { id: slideshow.id }, data: { status: "POSTED" } });

    return { ok: true, publishId };
  } catch (err) {
    const message = err instanceof TikTokApiError || err instanceof Error ? err.message : "Unknown posting error";
    await prisma.postHistory.create({
      data: {
        slideshowId: slideshow.id,
        tiktokAccountId: slideshow.tiktokAccount.id,
        status: "failed",
        errorMessage: message,
        generatedImages: JSON.stringify(imagePaths),
      },
    });
    await prisma.slideshow.update({ where: { id: slideshow.id }, data: { status: "FAILED" } });
    throw err;
  }
}
