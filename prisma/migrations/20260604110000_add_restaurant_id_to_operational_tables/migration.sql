-- Add nullable tenant anchors to operational restaurant-owned tables only.
ALTER TABLE "Reservation" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "Order" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "MenuItemIngredient" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "OrderRecipeConsumption" ADD COLUMN "restaurantId" TEXT;

-- Backfill existing single-demo rows only when the Demo Restaurant anchor exists.
UPDATE "Reservation"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "Order"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "OrderItem"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "InventoryItem"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "InventoryMovement"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "MenuItemIngredient"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

UPDATE "OrderRecipeConsumption"
SET "restaurantId" = 'demo-restaurant'
WHERE "restaurantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'demo-restaurant');

-- Indexes for future tenant-scoped operational reads.
CREATE INDEX "Reservation_restaurantId_idx" ON "Reservation"("restaurantId");
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");
CREATE INDEX "OrderItem_restaurantId_idx" ON "OrderItem"("restaurantId");
CREATE INDEX "InventoryItem_restaurantId_idx" ON "InventoryItem"("restaurantId");
CREATE INDEX "InventoryMovement_restaurantId_idx" ON "InventoryMovement"("restaurantId");
CREATE INDEX "MenuItemIngredient_restaurantId_idx" ON "MenuItemIngredient"("restaurantId");
CREATE INDEX "OrderRecipeConsumption_restaurantId_idx" ON "OrderRecipeConsumption"("restaurantId");

-- Nullable foreign keys preserve existing records if the tenant anchor is removed.
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuItemIngredient" ADD CONSTRAINT "MenuItemIngredient_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderRecipeConsumption" ADD CONSTRAINT "OrderRecipeConsumption_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
