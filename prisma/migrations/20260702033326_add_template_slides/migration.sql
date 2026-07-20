-- CreateTable
CREATE TABLE "SlideshowTemplateSlide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "imageMode" TEXT NOT NULL DEFAULT 'ai-auto',
    "referenceImagePath" TEXT,
    "randomImagePool" TEXT NOT NULL DEFAULT '[]',
    "customPrompt" TEXT,
    "variationDirection" TEXT,
    "textOverlayEnabled" BOOLEAN NOT NULL DEFAULT false,
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
    CONSTRAINT "SlideshowTemplateSlide_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SlideshowTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
