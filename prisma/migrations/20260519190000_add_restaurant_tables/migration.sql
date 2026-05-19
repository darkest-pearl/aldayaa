CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "seats" INTEGER,
    "zone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantTable_slug_key" ON "RestaurantTable"("slug");
CREATE UNIQUE INDEX "RestaurantTable_qrToken_key" ON "RestaurantTable"("qrToken");
CREATE INDEX "RestaurantTable_isActive_idx" ON "RestaurantTable"("isActive");
CREATE INDEX "RestaurantTable_zone_idx" ON "RestaurantTable"("zone");
