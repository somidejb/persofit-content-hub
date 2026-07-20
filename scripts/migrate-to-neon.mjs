/**
 * One-time migration: copies all data from the local SQLite dev.db to Neon PostgreSQL.
 *
 * Usage:
 *   NEON_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" node scripts/migrate-to-neon.mjs
 *
 * Or if your .env already has DIRECT_URL pointing to Neon:
 *   node -e "import('./scripts/migrate-to-neon.mjs')" (after setting env vars)
 *
 * Note: Generated images in public/uploads/ only exist locally. The Neon DB will have
 * the correct paths stored but you'll need to re-upload/re-generate images on production.
 */

import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const neonUrl = process.env.NEON_URL || process.env.DIRECT_URL;
if (!neonUrl || neonUrl.startsWith("file:")) {
  console.error(
    "❌ Set NEON_URL to your Neon direct connection string before running.\n" +
    "   Example: NEON_URL=\"postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require\" node scripts/migrate-to-neon.mjs"
  );
  process.exit(1);
}

const sqlitePath = path.join(__dirname, "../prisma/dev.db");
console.log(`📂 Reading SQLite from: ${sqlitePath}`);
console.log(`🌐 Writing to Neon: ${neonUrl.replace(/:([^@]+)@/, ":***@")}\n`);

const sqlite = new Database(sqlitePath, { readonly: true });
const neon = new PrismaClient({ datasources: { db: { url: neonUrl } } });

function bool(v) { return v === 1 || v === true; }
function dt(v) { return v ? new Date(v) : new Date(); }

async function run() {
  await neon.$connect();

  // ── 1. TiktokAccount ──────────────────────────────────────────────────────
  const accounts = sqlite.prepare("SELECT * FROM TiktokAccount").all();
  for (const a of accounts) {
    await neon.tiktokAccount.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        name: a.name,
        accessToken: a.accessToken,
        refreshToken: a.refreshToken ?? null,
        tokenExpiresAt: a.tokenExpiresAt ? new Date(a.tokenExpiresAt) : null,
        accountId: a.accountId ?? "",
        avatarUrl: a.avatarUrl ?? null,
        connected: bool(a.connected),
        createdAt: dt(a.createdAt),
      },
      update: {},
    });
  }
  console.log(`✓ ${accounts.length} TikTok account(s)`);

  // ── 2. Settings ───────────────────────────────────────────────────────────
  const settings = sqlite.prepare("SELECT * FROM Settings").all();
  for (const s of settings) {
    await neon.settings.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        openaiApiKey: s.openaiApiKey ?? null,
        imageModel: s.imageModel ?? "gpt-image-2",
        imageQuality: s.imageQuality ?? "medium",
        defaultAspectRatio: s.defaultAspectRatio ?? "9:16",
        defaultOutputWidth: s.defaultOutputWidth ?? 1080,
        defaultOutputHeight: s.defaultOutputHeight ?? 1920,
        globalBrandPrompt: s.globalBrandPrompt ?? null,
        tiktokClientKey: s.tiktokClientKey ?? null,
        tiktokClientSecret: s.tiktokClientSecret ?? null,
        tiktokRedirectUri: s.tiktokRedirectUri ?? null,
      },
      update: {},
    });
  }
  console.log(`✓ ${settings.length} settings row(s)`);

  // ── 3. SlideshowTemplate ──────────────────────────────────────────────────
  const templates = sqlite.prepare("SELECT * FROM SlideshowTemplate").all();
  for (const t of templates) {
    await neon.slideshowTemplate.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        name: t.name,
        caption: t.caption ?? "",
        hashtags: t.hashtags ?? "",
        tiktokAccountId: t.tiktokAccountId ?? null,
        concept: t.concept,
        variables: t.variables ?? null,
        slideCount: t.slideCount ?? 7,
        referenceImagePath: t.referenceImagePath ?? null,
        aspectRatio: t.aspectRatio ?? "9:16",
        outputWidth: t.outputWidth ?? 1080,
        outputHeight: t.outputHeight ?? 1920,
        postTime: t.postTime ?? "09:00",
        scheduleDays: t.scheduleDays ?? '["mon","tue","wed","thu","fri","sat","sun"]',
        autoPost: bool(t.autoPost),
        active: bool(t.active),
        createdAt: dt(t.createdAt),
        updatedAt: dt(t.updatedAt),
      },
      update: {},
    });
  }
  console.log(`✓ ${templates.length} template(s)`);

  // ── 4. SlideshowTemplateSlide ─────────────────────────────────────────────
  const tSlides = sqlite.prepare("SELECT * FROM SlideshowTemplateSlide").all();
  for (const ts of tSlides) {
    await neon.slideshowTemplateSlide.upsert({
      where: { id: ts.id },
      create: {
        id: ts.id,
        templateId: ts.templateId,
        order: ts.order,
        imageMode: ts.imageMode ?? "ai-auto",
        referenceImagePath: ts.referenceImagePath ?? null,
        randomImagePool: ts.randomImagePool ?? "[]",
        customPrompt: ts.customPrompt ?? null,
        variationDirection: ts.variationDirection ?? null,
        textOverlayEnabled: bool(ts.textOverlayEnabled),
        overlayText: ts.overlayText ?? null,
        overlaySubtext: ts.overlaySubtext ?? null,
        textPosition: ts.textPosition ?? "center",
        textSize: ts.textSize ?? "large",
        textAlign: ts.textAlign ?? "center",
        textColor: ts.textColor ?? "white",
        textAccentColor: ts.textAccentColor ?? "#00FF87",
        textStyle: ts.textStyle ?? "bold",
        textShadow: bool(ts.textShadow),
        textBoxEnabled: bool(ts.textBoxEnabled),
        textBoxOpacity: ts.textBoxOpacity ?? 0.45,
      },
      update: {},
    });
  }
  console.log(`✓ ${tSlides.length} template slide(s)`);

  // ── 5. Slideshow ──────────────────────────────────────────────────────────
  const slideshows = sqlite.prepare("SELECT * FROM Slideshow").all();
  for (const ss of slideshows) {
    await neon.slideshow.upsert({
      where: { id: ss.id },
      create: {
        id: ss.id,
        name: ss.name,
        caption: ss.caption ?? "",
        hashtags: ss.hashtags ?? "",
        status: ss.status ?? "DRAFT",
        tiktokAccountId: ss.tiktokAccountId ?? null,
        aspectRatio: ss.aspectRatio ?? "9:16",
        outputWidth: ss.outputWidth ?? 1080,
        outputHeight: ss.outputHeight ?? 1920,
        createdAt: dt(ss.createdAt),
        updatedAt: dt(ss.updatedAt),
      },
      update: {},
    });
  }
  console.log(`✓ ${slideshows.length} slideshow(s)`);

  // ── 6. SlideshowTemplateRun ───────────────────────────────────────────────
  const runs = sqlite.prepare("SELECT * FROM SlideshowTemplateRun").all();
  for (const r of runs) {
    await neon.slideshowTemplateRun.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        templateId: r.templateId,
        slideshowId: r.slideshowId ?? null,
        status: r.status ?? "GENERATING",
        scheduledFor: r.scheduledFor,
        errorMessage: r.errorMessage ?? null,
        createdAt: dt(r.createdAt),
      },
      update: {},
    });
  }
  console.log(`✓ ${runs.length} template run(s)`);

  // ── 7. Slide ──────────────────────────────────────────────────────────────
  const slides = sqlite.prepare("SELECT * FROM Slide").all();
  for (const sl of slides) {
    await neon.slide.upsert({
      where: { id: sl.id },
      create: {
        id: sl.id,
        slideshowId: sl.slideshowId,
        order: sl.order,
        imageMode: sl.imageMode ?? "generate",
        referenceImagePath: sl.referenceImagePath ?? null,
        randomImagePool: sl.randomImagePool ?? null,
        slidePurpose: sl.slidePurpose ?? "hook",
        referenceType: sl.referenceType ?? "mirror_selfie",
        variationAngle: sl.variationAngle ?? "shirt_too_tight",
        customPrompt: sl.customPrompt ?? null,
        variationDirection: sl.variationDirection ?? null,
        finalPrompt: sl.finalPrompt ?? null,
        overlayText: sl.overlayText ?? null,
        overlaySubtext: sl.overlaySubtext ?? null,
        textPosition: sl.textPosition ?? "center",
        textSize: sl.textSize ?? "large",
        textAlign: sl.textAlign ?? "center",
        textColor: sl.textColor ?? "white",
        textAccentColor: sl.textAccentColor ?? "#00FF87",
        textStyle: sl.textStyle ?? "bold",
        textShadow: bool(sl.textShadow),
        textBoxEnabled: bool(sl.textBoxEnabled),
        textBoxOpacity: sl.textBoxOpacity ?? 0.45,
        textOverlayEnabled: bool(sl.textOverlayEnabled),
        generatedImagePath: sl.generatedImagePath ?? null,
        processedImagePath: sl.processedImagePath ?? null,
        finalImagePath: sl.finalImagePath ?? null,
        status: sl.status ?? "draft",
        errorMessage: sl.errorMessage ?? null,
        createdAt: dt(sl.createdAt),
        updatedAt: dt(sl.updatedAt),
      },
      update: {},
    });
  }
  console.log(`✓ ${slides.length} slide(s)`);

  // ── 8. Schedule ───────────────────────────────────────────────────────────
  const schedules = sqlite.prepare("SELECT * FROM Schedule").all();
  for (const sc of schedules) {
    await neon.schedule.upsert({
      where: { id: sc.id },
      create: {
        id: sc.id,
        slideshowId: sc.slideshowId,
        postTime: sc.postTime,
        dates: sc.dates,
        status: sc.status ?? "PENDING",
        createdAt: dt(sc.createdAt),
      },
      update: {},
    });
  }
  console.log(`✓ ${schedules.length} schedule(s)`);

  // ── 9. PostHistory ────────────────────────────────────────────────────────
  const posts = sqlite.prepare("SELECT * FROM PostHistory").all();
  for (const p of posts) {
    await neon.postHistory.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        slideshowId: p.slideshowId,
        tiktokAccountId: p.tiktokAccountId ?? null,
        postedAt: dt(p.postedAt),
        status: p.status,
        errorMessage: p.errorMessage ?? null,
        generatedImages: p.generatedImages,
        views: p.views ?? 0,
        likes: p.likes ?? 0,
      },
      update: {},
    });
  }
  console.log(`✓ ${posts.length} post history entries`);

  await neon.$disconnect();
  sqlite.close();
  console.log("\n✅ Migration complete! All data is now in Neon.");
  console.log("⚠️  Note: generated images in public/uploads/ only exist locally.");
  console.log("   Slides that reference them will need to be re-generated on production.");
}

run().catch((err) => {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
});
