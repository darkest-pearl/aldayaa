ALTER TABLE "Order" ADD COLUMN "createdByAdminId" TEXT;
ALTER TABLE "Order" ADD COLUMN "createdByAdminEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "orderSource" TEXT NOT NULL DEFAULT 'CUSTOMER';

CREATE INDEX "Order_createdByAdminId_idx" ON "Order"("createdByAdminId");
CREATE INDEX "Order_orderSource_idx" ON "Order"("orderSource");
