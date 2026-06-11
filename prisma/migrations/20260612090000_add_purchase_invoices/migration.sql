CREATE TABLE "PurchaseInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByAdminId" TEXT,
    "createdByAdminEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseRequestId" TEXT,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseInvoiceLine" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "inventoryItemId" TEXT,

    CONSTRAINT "PurchaseInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseInvoice_restaurantId_invoiceNumber_key" ON "PurchaseInvoice"("restaurantId", "invoiceNumber");
CREATE INDEX "PurchaseInvoice_restaurantId_idx" ON "PurchaseInvoice"("restaurantId");
CREATE INDEX "PurchaseInvoice_supplierId_idx" ON "PurchaseInvoice"("supplierId");
CREATE INDEX "PurchaseInvoice_purchaseRequestId_idx" ON "PurchaseInvoice"("purchaseRequestId");
CREATE INDEX "PurchaseInvoice_status_idx" ON "PurchaseInvoice"("status");
CREATE INDEX "PurchaseInvoice_invoiceDate_idx" ON "PurchaseInvoice"("invoiceDate");
CREATE INDEX "PurchaseInvoiceLine_restaurantId_idx" ON "PurchaseInvoiceLine"("restaurantId");
CREATE INDEX "PurchaseInvoiceLine_purchaseInvoiceId_idx" ON "PurchaseInvoiceLine"("purchaseInvoiceId");
CREATE INDEX "PurchaseInvoiceLine_inventoryItemId_idx" ON "PurchaseInvoiceLine"("inventoryItemId");

ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_purchaseRequestId_fkey"
FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_purchaseInvoiceId_fkey"
FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
