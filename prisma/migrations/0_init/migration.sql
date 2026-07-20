-- CreateTable
CREATE TABLE "TiktokAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "accountId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TiktokAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slideshow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "tiktokAccountId" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "outputWidth" INTEGER NOT NULL DEFAULT 1080,
    "outputHeight" INTEGER NOT NULL DEFAULT 1920,
    "tiktokMusicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slideshow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slide" (
    "id" TEXT NOT NULL,
    "slideshowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "imageMode" TEXT NOT NULL DEFAULT 'generate',
    "referenceImagePath" TEXT,
    "randomImagePool" TEXT,
    "slidePurpose" TEXT NOT NULL DEFAULT 'hook',
    "referenceType" TEXT NOT NULL DEFAULT 'mirror_selfie',
    "variationAngle" TEXT NOT NULL DEFAULT 'shirt_too_tight',
    "customPrompt" TEXT,
    "variationDirection" TEXT,
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
    "textBoxOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
    "textOverlayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "generatedImagePath" TEXT,
    "processedImagePath" TEXT,
    "finalImagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "slideshowId" TEXT NOT NULL,
    "postTime" TEXT NOT NULL,
    "dates" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostHistory" (
    "id" TEXT NOT NULL,
    "slideshowId" TEXT NOT NULL,
    "tiktokAccountId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "generatedImages" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlideshowTemplate" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlideshowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlideshowTemplateSlide" (
    "id" TEXT NOT NULL,
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
    "textBoxOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.45,

    CONSTRAINT "SlideshowTemplateSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlideshowTemplateRun" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "slideshowId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "scheduledFor" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlideshowTemplateRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "openaiApiKey" TEXT,
    "imageModel" TEXT NOT NULL DEFAULT 'gpt-image-2',
    "imageQuality" TEXT NOT NULL DEFAULT 'medium',
    "defaultAspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "defaultOutputWidth" INTEGER NOT NULL DEFAULT 1080,
    "defaultOutputHeight" INTEGER NOT NULL DEFAULT 1920,
    "globalBrandPrompt" TEXT,
    "tiktokClientKey" TEXT,
    "tiktokClientSecret" TEXT,
    "tiktokRedirectUri" TEXT,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Slideshow" ADD CONSTRAINT "Slideshow_tiktokAccountId_fkey" FOREIGN KEY ("tiktokAccountId") REFERENCES "TiktokAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slide" ADD CONSTRAINT "Slide_slideshowId_fkey" FOREIGN KEY ("slideshowId") REFERENCES "Slideshow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_slideshowId_fkey" FOREIGN KEY ("slideshowId") REFERENCES "Slideshow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostHistory" ADD CONSTRAINT "PostHistory_slideshowId_fkey" FOREIGN KEY ("slideshowId") REFERENCES "Slideshow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostHistory" ADD CONSTRAINT "PostHistory_tiktokAccountId_fkey" FOREIGN KEY ("tiktokAccountId") REFERENCES "TiktokAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideshowTemplate" ADD CONSTRAINT "SlideshowTemplate_tiktokAccountId_fkey" FOREIGN KEY ("tiktokAccountId") REFERENCES "TiktokAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideshowTemplateSlide" ADD CONSTRAINT "SlideshowTemplateSlide_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SlideshowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideshowTemplateRun" ADD CONSTRAINT "SlideshowTemplateRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SlideshowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
