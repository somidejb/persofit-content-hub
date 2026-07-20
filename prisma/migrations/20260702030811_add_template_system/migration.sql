-- CreateTable
CREATE TABLE "SlideshowTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '',
    "tiktokAccountId" TEXT,
    "concept" TEXT NOT NULL,
    "variables" TEXT,
    "slideCount" INTEGER NOT NULL DEFAULT 7,
    "referenceImagePath" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "outputWidth" INTEGER NOT NULL DEFAULT 1080,
    "outputHeight" INTEGER NOT NULL DEFAULT 1920,
    "postTime" TEXT NOT NULL DEFAULT '09:00',
    "scheduleDays" TEXT NOT NULL DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]',
    "autoPost" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SlideshowTemplate_tiktokAccountId_fkey" FOREIGN KEY ("tiktokAccountId") REFERENCES "TiktokAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SlideshowTemplateRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "slideshowId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "scheduledFor" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SlideshowTemplateRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SlideshowTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
