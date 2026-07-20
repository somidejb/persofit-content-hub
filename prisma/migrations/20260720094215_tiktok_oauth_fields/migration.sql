-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "tiktokClientKey" TEXT;
ALTER TABLE "Settings" ADD COLUMN "tiktokClientSecret" TEXT;
ALTER TABLE "Settings" ADD COLUMN "tiktokRedirectUri" TEXT;

-- AlterTable
ALTER TABLE "TiktokAccount" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "TiktokAccount" ADD COLUMN "tokenExpiresAt" DATETIME;
