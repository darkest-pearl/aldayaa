-- Add nullable tenant anchors to low-risk content/configuration tables only.
ALTER TABLE "RestaurantProfile" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "MenuCategory" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "GalleryCategory" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "Photo" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "RestaurantTable" ADD COLUMN "restaurantId" TEXT;

-- Backfill existing single-demo rows only when the Demo Restaurant anchor exists.
UPDATE "RestaurantProfile"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "RestaurantSettings"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "MenuCategory"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "MenuItem"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "GalleryCategory"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "Photo"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "Announcement"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "RestaurantTable"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

-- Indexes for future tenant-scoped reads.
CREATE INDEX "RestaurantProfile_restaurantId_idx" ON "RestaurantProfile"("restaurantId");
CREATE INDEX "RestaurantSettings_restaurantId_idx" ON "RestaurantSettings"("restaurantId");
CREATE INDEX "MenuCategory_restaurantId_idx" ON "MenuCategory"("restaurantId");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE INDEX "GalleryCategory_restaurantId_idx" ON "GalleryCategory"("restaurantId");
CREATE INDEX "Photo_restaurantId_idx" ON "Photo"("restaurantId");
CREATE INDEX "Announcement_restaurantId_idx" ON "Announcement"("restaurantId");
CREATE INDEX "RestaurantTable_restaurantId_idx" ON "RestaurantTable"("restaurantId");

-- Nullable foreign keys preserve existing records if the tenant anchor is removed.
ALTER TABLE "RestaurantProfile" ADD CONSTRAINT "RestaurantProfile_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantSettings" ADD CONSTRAINT "RestaurantSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GalleryCategory" ADD CONSTRAINT "GalleryCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
