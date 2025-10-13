-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."animation_settings" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "items" JSONB NOT NULL DEFAULT '["❤️", "💖", "💕", "💗", "💝"]',
    "itemCount" INTEGER NOT NULL DEFAULT 50,
    "duration" INTEGER NOT NULL DEFAULT 3000,
    "maxViewsPerUser" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."animation_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animation_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "animation_views_userId_idx" ON "public"."animation_views"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "animation_views_userId_key" ON "public"."animation_views"("userId");

-- AddForeignKey
ALTER TABLE "public"."animation_views" ADD CONSTRAINT "animation_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
