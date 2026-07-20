/*
  Warnings:

  - You are about to drop the column `xaiApiKey` on the `Settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Slide" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "Slide" ADD COLUMN "processedImagePath" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "openaiApiKey" TEXT,
    "imageModel" TEXT NOT NULL DEFAULT 'gpt-image-2',
    "imageQuality" TEXT NOT NULL DEFAULT 'medium',
    "defaultAspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "defaultOutputWidth" INTEGER NOT NULL DEFAULT 1080,
    "defaultOutputHeight" INTEGER NOT NULL DEFAULT 1920,
    "globalBrandPrompt" TEXT
);
INSERT INTO "new_Settings" ("globalBrandPrompt", "id") SELECT "globalBrandPrompt", "id" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_Slideshow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "tiktokAccountId" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "outputWidth" INTEGER NOT NULL DEFAULT 1080,
    "outputHeight" INTEGER NOT NULL DEFAULT 1920,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Slideshow_tiktokAccountId_fkey" FOREIGN KEY ("tiktokAccountId") REFERENCES "TiktokAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Slideshow" ("caption", "createdAt", "hashtags", "id", "name", "status", "tiktokAccountId", "updatedAt") SELECT "caption", "createdAt", "hashtags", "id", "name", "status", "tiktokAccountId", "updatedAt" FROM "Slideshow";
DROP TABLE "Slideshow";
ALTER TABLE "new_Slideshow" RENAME TO "Slideshow";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
