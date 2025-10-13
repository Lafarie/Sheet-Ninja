-- CreateTable
CREATE TABLE "public"."user_animation_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "items" JSONB NOT NULL DEFAULT '["❤️", "💖", "💕", "💗", "💝"]',
    "itemCount" INTEGER NOT NULL DEFAULT 50,
    "duration" INTEGER NOT NULL DEFAULT 3000,
    "maxViewsPerUser" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_animation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_animation_settings_userId_key" ON "public"."user_animation_settings"("userId");

-- CreateIndex
CREATE INDEX "user_animation_settings_userId_idx" ON "public"."user_animation_settings"("userId");

-- AddForeignKey
ALTER TABLE "public"."user_animation_settings" ADD CONSTRAINT "user_animation_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
