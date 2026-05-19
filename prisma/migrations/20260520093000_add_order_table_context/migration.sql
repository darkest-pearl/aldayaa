ALTER TABLE "Order" ADD COLUMN "tableId" TEXT;
ALTER TABLE "Order" ADD COLUMN "tableLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN "tableSlug" TEXT;
ALTER TABLE "Order" ADD COLUMN "orderContext" TEXT NOT NULL DEFAULT 'STANDARD';

CREATE INDEX "Order_tableId_idx" ON "Order"("tableId");
CREATE INDEX "Order_orderContext_idx" ON "Order"("orderContext");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_tableId_fkey"
FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
