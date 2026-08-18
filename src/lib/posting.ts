import { prisma } from "./prisma";
import { postPhotoSlideshow, refreshTikTokToken, TikTokApiError } from "./tiktok";
import { generateAllSlides } from "./generation";

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

  const rawPaths = slideshow.slides.map((s) => s.finalImagePath as string);

  // TikTok's PULL_FROM_URL requires images to be on a developer-verified domain.
  // Raw Vercel Blob URLs (*.vercel-storage.com) are on a domain we don't own, so
  // we proxy them through our own app domain via /api/media/proxy.
  // Set NEXT_PUBLIC_APP_URL in Vercel env vars to your stable production URL.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const imageUrls = rawPaths.map((p) => {
    if (p.startsWith("http://") || p.startsWith("https://")) {
      // Encode blob URL into the path so it starts with /api/media/proxy/
      // matching TikTok's verified URL prefix exactly.
      const encoded = Buffer.from(p).toString("base64url");
      return `${appUrl}/api/media/proxy/${encoded}`;
    }
    // Local dev path — TikTok can't reach localhost, but correct format
    return `${appUrl}${p.startsWith("/") ? "" : "/"}${p}`;
  });

  try {
    const accessToken = await getValidAccessToken(slideshow.tiktokAccount.id);

    const { publishId } = await postPhotoSlideshow({
      accessToken,
      imageUrls,
      caption: slideshow.caption,
      hashtags: slideshow.hashtags,
      musicId: slideshow.tiktokMusicId ?? undefined,
    });

    await prisma.postHistory.create({
      data: {
        slideshowId: slideshow.id,
        tiktokAccountId: slideshow.tiktokAccount.id,
        status: "posted",
        generatedImages: JSON.stringify(imageUrls),
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
        generatedImages: JSON.stringify(imageUrls),
      },
    });
    await prisma.slideshow.update({ where: { id: slideshow.id }, data: { status: "FAILED" } });
    throw err;
  }
}

export type MultiPostProgressEvent =
  | { type: "account_start"; accountId: string; accountName: string; index: number; total: number }
  | { type: "slide_start"; accountId: string; slideId: string }
  | { type: "slide_done"; accountId: string; slideId: string; finalImagePath: string }
  | { type: "slide_failed"; accountId: string; slideId: string; message: string }
  | { type: "account_posted"; accountId: string; accountName: string; slideshowId: string; publishId: string }
  | { type: "account_failed"; accountId: string; accountName: string; slideshowId: string | null; message: string };

export type MultiPostResult = {
  accountId: string;
  accountName: string;
  slideshowId: string | null;
  ok: boolean;
  publishId?: string;
  error?: string;
};

/**
 * Creates an independent copy of a slideshow (all fields + slides) targeting
 * one account. Generation state is intentionally reset so the clone gets a
 * fresh, independently-generated set of images rather than reusing the
 * master's output.
 */
async function cloneSlideshowForAccount(masterId: string, accountId: string): Promise<string> {
  const [master, account] = await Promise.all([
    prisma.slideshow.findUnique({
      where: { id: masterId },
      include: { slides: { orderBy: { order: "asc" } } },
    }),
    prisma.tiktokAccount.findUnique({ where: { id: accountId } }),
  ]);
  if (!master) throw new Error("Slideshow not found");
  if (!account) throw new Error("TikTok account not found");

  const clone = await prisma.slideshow.create({
    data: {
      name: `${master.name} — @${account.name}`,
      caption: master.caption,
      hashtags: master.hashtags,
      status: "DRAFT",
      tiktokAccountId: accountId,
      aspectRatio: master.aspectRatio,
      outputWidth: master.outputWidth,
      outputHeight: master.outputHeight,
      tiktokMusicId: master.tiktokMusicId,
      sourceSlideshowId: master.id,
      slides: {
        create: master.slides.map((s) => ({
          order: s.order,
          imageMode: s.imageMode,
          referenceImagePath: s.referenceImagePath,
          randomImagePool: s.randomImagePool,
          slidePurpose: s.slidePurpose,
          referenceType: s.referenceType,
          variationAngle: s.variationAngle,
          customPrompt: s.customPrompt,
          variationDirection: s.variationDirection,
          textOverlayEnabled: s.textOverlayEnabled,
          overlayText: s.overlayText,
          overlaySubtext: s.overlaySubtext,
          textPosition: s.textPosition,
          textSize: s.textSize,
          textAlign: s.textAlign,
          textColor: s.textColor,
          textAccentColor: s.textAccentColor,
          textStyle: s.textStyle,
          textShadow: s.textShadow,
          textBoxEnabled: s.textBoxEnabled,
          textBoxOpacity: s.textBoxOpacity,
          // generatedImagePath / processedImagePath / finalImagePath / finalPrompt /
          // status / errorMessage are deliberately left at their defaults — this
          // clone generates its own fresh variation.
        })),
      },
    },
  });

  return clone.id;
}

/**
 * Posts a slideshow to multiple TikTok accounts. For each account, clones
 * the slideshow, generates every slide fresh (an independent AI pass, not a
 * copy of any other account's images), then posts that clone. Persists the
 * account selection on the master slideshow so the picker remembers it.
 */
export async function postSlideshowToAccounts(
  masterId: string,
  accountIds: string[],
  onProgress?: (event: MultiPostProgressEvent) => void | Promise<void>
): Promise<MultiPostResult[]> {
  await prisma.slideshow.update({
    where: { id: masterId },
    data: { targetAccountIds: JSON.stringify(accountIds) },
  });

  const accounts = await prisma.tiktokAccount.findMany({ where: { id: { in: accountIds } } });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const results: MultiPostResult[] = [];

  for (let i = 0; i < accountIds.length; i++) {
    const accountId = accountIds[i];
    const accountName = accountMap.get(accountId)?.name ?? "Unknown account";
    await onProgress?.({ type: "account_start", accountId, accountName, index: i + 1, total: accountIds.length });

    let cloneId: string | null = null;
    try {
      cloneId = await cloneSlideshowForAccount(masterId, accountId);

      const { failed } = await generateAllSlides(cloneId, async (event) => {
        if (event.type === "slide_start") {
          await onProgress?.({ type: "slide_start", accountId, slideId: event.slideId });
        } else if (event.type === "slide_done") {
          await onProgress?.({ type: "slide_done", accountId, slideId: event.slideId, finalImagePath: event.finalImagePath });
        } else if (event.type === "slide_failed") {
          await onProgress?.({ type: "slide_failed", accountId, slideId: event.slideId, message: event.message });
        }
      });
      if (failed) throw new Error("One or more slides failed to generate");

      const postResult = await postSlideshowNow(cloneId);
      await onProgress?.({ type: "account_posted", accountId, accountName, slideshowId: cloneId, publishId: postResult.publishId });
      results.push({ accountId, accountName, slideshowId: cloneId, ok: true, publishId: postResult.publishId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await onProgress?.({ type: "account_failed", accountId, accountName, slideshowId: cloneId, message });
      results.push({ accountId, accountName, slideshowId: cloneId, ok: false, error: message });
    }
  }

  return results;
}
