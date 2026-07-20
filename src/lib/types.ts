// Shared shapes used across UI components. These mirror the Prisma models;
// see src/lib/adapters.ts for the conversion from Prisma rows to these types.

export type OverlaySettings = {
  overlayText: string | null;
  overlaySubtext: string | null;
  textPosition: string;
  textSize: string;
  textAlign: string;
  textColor: string;
  textAccentColor: string;
  textStyle: string;
  textShadow: boolean;
  textBoxEnabled: boolean;
  textBoxOpacity: number;
};

export type MockSlide = OverlaySettings & {
  id: string;
  order: number;
  imageMode: "generate" | "random-pick";
  referenceImagePath: string | null;
  randomImagePool: string[];
  customPrompt: string | null;
  variationDirection: string | null;
  finalPrompt: string | null;
  textOverlayEnabled: boolean;
  generatedImagePath: string | null;
  processedImagePath: string | null;
  finalImagePath: string | null;
  status: "draft" | "generating" | "done" | "failed";
  errorMessage: string | null;
};

export type MockSlideshow = {
  id: string;
  name: string;
  caption: string;
  hashtags: string;
  status: "DRAFT" | "SCHEDULED" | "GENERATING" | "POSTED" | "FAILED";
  tiktokAccountId: string | null;
  tiktokAccountName: string | null;
  aspectRatio: string;
  outputWidth: number;
  outputHeight: number;
  slides: MockSlide[];
  nextPostDate: string | null;
  postTime: string | null;
  views: number;
  likes: number;
  updatedAt: string;
};

export type MockAccount = {
  id: string;
  name: string;
  accountId: string;
  connected: boolean;
  slideshowCount: number;
  tokenExpiresAt: string | null;
  hasRefreshToken: boolean;
};

export type MockHistoryEntry = {
  id: string;
  slideshowName: string;
  accountName: string;
  postedAt: string;
  status: "posted" | "failed";
  errorMessage?: string;
  slideCount: number;
};

export type MockScheduleEntry = {
  id: string;
  slideshowId: string;
  slideshowName: string;
  accountName: string;
  date: string;
  time: string;
  status: "PENDING" | "GENERATING" | "POSTED" | "FAILED";
};
