-- Backfill existing singleton demo rows to the Demo Restaurant tenant anchor when available.
UPDATE "RestaurantProfile"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "RestaurantSettings"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

-- Replace singleton constant ID defaults with tenant-safe generated integer sequences.
CREATE SEQUENCE IF NOT EXISTS "RestaurantProfile_id_seq";
ALTER SEQUENCE "RestaurantProfile_id_seq" OWNED BY "RestaurantProfile"."id";
SELECT setval(
  '"RestaurantProfile_id_seq"',
  GREATEST(COALESCE((SELECT MAX("id") FROM "RestaurantProfile"), 0) + 1, 1),
  false
);
ALTER TABLE "RestaurantProfile"
  ALTER COLUMN "id" SET DEFAULT nextval('"RestaurantProfile_id_seq"');

CREATE SEQUENCE IF NOT EXISTS "RestaurantSettings_id_seq";
ALTER SEQUENCE "RestaurantSettings_id_seq" OWNED BY "RestaurantSettings"."id";
SELECT setval(
  '"RestaurantSettings_id_seq"',
  GREATEST(COALESCE((SELECT MAX("id") FROM "RestaurantSettings"), 0) + 1, 1),
  false
);
ALTER TABLE "RestaurantSettings"
  ALTER COLUMN "id" SET DEFAULT nextval('"RestaurantSettings_id_seq"');

-- PostgreSQL unique indexes allow multiple NULL values, which keeps restaurantId nullable during transition.
CREATE UNIQUE INDEX "RestaurantProfile_restaurantId_key" ON "RestaurantProfile"("restaurantId");
CREATE UNIQUE INDEX "RestaurantSettings_restaurantId_key" ON "RestaurantSettings"("restaurantId");
