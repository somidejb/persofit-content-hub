import type { Slideshow, Slide, Schedule, PostHistory, TiktokAccount } from "@prisma/client";
import type {
  MockSlideshow,
  MockSlide,
  MockAccount,
  MockHistoryEntry,
  MockScheduleEntry,
} from "./types";

export type FullSlideshow = Slideshow & {
  slides: Slide[];
  tiktokAccount: TiktokAccount | null;
  schedules: Schedule[];
  posts: PostHistory[];
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function toSlideshowCard(s: FullSlideshow): MockSlideshow {
  const views = s.posts.reduce((sum, p) => sum + p.views, 0);
  const likes = s.posts.reduce((sum, p) => sum + p.likes, 0);

  let nextPostDate: string | null = null;
  let postTime: string | null = null;
  const today = todayIso();
  for (const sched of s.schedules) {
    let dates: string[] = [];
    try {
      dates = JSON.parse(sched.dates || "[]");
    } catch {
      dates = [];
    }
    const upcoming = dates.filter((d) => d >= today).sort();
    if (upcoming.length && (!nextPostDate || upcoming[0] < nextPostDate)) {
      nextPostDate = upcoming[0];
      postTime = sched.postTime;
    }
  }

  return {
    id: s.id,
    name: s.name,
    caption: s.caption,
    hashtags: s.hashtags,
    status: s.status as MockSlideshow["status"],
    tiktokAccountId: s.tiktokAccountId,
    tiktokAccountName: s.tiktokAccount?.name ?? null,
    aspectRatio: s.aspectRatio,
    outputWidth: s.outputWidth,
    outputHeight: s.outputHeight,
    slides: [...s.slides]
      .sort((a, b) => a.order - b.order)
      .map((sl) => toSlide(sl)),
    nextPostDate,
    postTime,
    views,
    likes,
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toSlide(sl: Slide): MockSlide {
  let randomImagePool: string[] = [];
  try { randomImagePool = JSON.parse(sl.randomImagePool ?? "[]"); } catch { randomImagePool = []; }

  return {
    id: sl.id,
    order: sl.order,
    imageMode: (sl.imageMode === "random-pick" ? "random-pick" : "generate") as MockSlide["imageMode"],
    referenceImagePath: sl.referenceImagePath,
    randomImagePool,
    customPrompt: sl.customPrompt,
    variationDirection: sl.variationDirection,
    finalPrompt: sl.finalPrompt,
    textOverlayEnabled: sl.textOverlayEnabled,
    overlayText: sl.overlayText,
    overlaySubtext: sl.overlaySubtext,
    textPosition: sl.textPosition,
    textSize: sl.textSize,
    textAlign: sl.textAlign,
    textColor: sl.textColor,
    textAccentColor: sl.textAccentColor,
    textStyle: sl.textStyle,
    textShadow: sl.textShadow,
    textBoxEnabled: sl.textBoxEnabled,
    textBoxOpacity: sl.textBoxOpacity,
    generatedImagePath: sl.generatedImagePath,
    processedImagePath: sl.processedImagePath,
    finalImagePath: sl.finalImagePath,
    status: sl.status as MockSlide["status"],
    errorMessage: sl.errorMessage,
  };
}

export function toAccount(a: TiktokAccount & { _count?: { slideshows: number } }): MockAccount {
  return {
    id: a.id,
    name: a.name,
    accountId: a.accountId,
    connected: a.connected,
    slideshowCount: a._count?.slideshows ?? 0,
    tokenExpiresAt: a.tokenExpiresAt ? a.tokenExpiresAt.toISOString() : null,
    hasRefreshToken: !!a.refreshToken,
  };
}

export function toHistoryEntry(
  h: PostHistory & { slideshow: Slideshow; tiktokAccount: TiktokAccount | null }
): MockHistoryEntry {
  let images: string[] = [];
  try {
    images = JSON.parse(h.generatedImages || "[]");
  } catch {
    images = [];
  }
  return {
    id: h.id,
    slideshowName: h.slideshow.name,
    accountName: h.tiktokAccount?.name ?? "Unknown account",
    postedAt: h.postedAt.toISOString(),
    status: h.status as MockHistoryEntry["status"],
    errorMessage: h.errorMessage ?? undefined,
    slideCount: images.length,
  };
}

export function toScheduleEntries(
  s: Schedule & { slideshow: Slideshow & { tiktokAccount: TiktokAccount | null } }
): MockScheduleEntry[] {
  let dates: string[] = [];
  try {
    dates = JSON.parse(s.dates || "[]");
  } catch {
    dates = [];
  }
  return dates.map((date, i) => ({
    id: `${s.id}_${i}`,
    slideshowId: s.slideshowId,
    slideshowName: s.slideshow.name,
    accountName: s.slideshow.tiktokAccount?.name ?? "No account",
    date,
    time: s.postTime,
    status: s.status as MockScheduleEntry["status"],
  }));
}
