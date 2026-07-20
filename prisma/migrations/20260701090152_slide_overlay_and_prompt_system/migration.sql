/*
  Warnings:

  - You are about to drop the column `generationStatus` on the `Slide` table. All the data in the column will be lost.
  - You are about to drop the column `prompt` on the `Slide` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Slide` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "globalBrandPrompt" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Slide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slideshowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "referenceImagePath" TEXT,
    "slidePurpose" TEXT NOT NULL DEFAULT 'hook',
    "referenceType" TEXT NOT NULL DEFAULT 'mirror_selfie',
    "variationAngle" TEXT NOT NULL DEFAULT 'shirt_too_tight',
    "customPrompt" TEXT,
    "finalPrompt" TEXT,
    "overlayText" TEXT,
    "overlaySubtext" TEXT,
    "textPosition" TEXT NOT NULL DEFAULT 'center',
    "textSize" TEXT NOT NULL DEFAULT 'large',
    "textAlign" TEXT NOT NULL DEFAULT 'center',
    "textColor" TEXT NOT NULL DEFAULT 'white',
    "textAccentColor" TEXT NOT NULL DEFAULT '#00FF87',
    "textStyle" TEXT NOT NULL DEFAULT 'bold',
    "textShadow" BOOLEAN NOT NULL DEFAULT true,
    "textBoxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "textBoxOpacity" REAL NOT NULL DEFAULT 0.45,
    "generatedImagePath" TEXT,
    "finalImagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Slide_slideshowId_fkey" FOREIGN KEY ("slideshowId") REFERENCES "Slideshow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Slide" ("createdAt", "generatedImagePath", "id", "order", "referenceImagePath", "slideshowId") SELECT "createdAt", "generatedImagePath", "id", "order", "referenceImagePath", "slideshowId" FROM "Slide";
DROP TABLE "Slide";
ALTER TABLE "new_Slide" RENAME TO "Slide";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
