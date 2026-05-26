CREATE TABLE "OrderRecipeConsumption" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "appliedByAdminId" TEXT,
    "appliedByAdminEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRecipeConsumption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderRecipeConsumption_orderId_idx" ON "OrderRecipeConsumption"("orderId");
CREATE INDEX "OrderRecipeConsumption_createdAt_idx" ON "OrderRecipeConsumption"("createdAt");
CREATE UNIQUE INDEX "OrderRecipeConsumption_orderId_status_key" ON "OrderRecipeConsumption"("orderId", "status");

ALTER TABLE "OrderRecipeConsumption" ADD CONSTRAINT "OrderRecipeConsumption_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
