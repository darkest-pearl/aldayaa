CREATE TABLE "PurchaseInvoicePayment" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "createdByAdminId" TEXT,
    "createdByAdminEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,

    CONSTRAINT "PurchaseInvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseInvoicePayment_restaurantId_idx" ON "PurchaseInvoicePayment"("restaurantId");
CREATE INDEX "PurchaseInvoicePayment_purchaseInvoiceId_idx" ON "PurchaseInvoicePayment"("purchaseInvoiceId");
CREATE INDEX "PurchaseInvoicePayment_paidAt_idx" ON "PurchaseInvoicePayment"("paidAt");
CREATE INDEX "PurchaseInvoicePayment_status_idx" ON "PurchaseInvoicePayment"("status");
CREATE INDEX "PurchaseInvoicePayment_method_idx" ON "PurchaseInvoicePayment"("method");

ALTER TABLE "PurchaseInvoicePayment" ADD CONSTRAINT "PurchaseInvoicePayment_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoicePayment" ADD CONSTRAINT "PurchaseInvoicePayment_purchaseInvoiceId_fkey"
FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
