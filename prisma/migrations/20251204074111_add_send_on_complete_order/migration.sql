-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "deliveryType" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "totalPrice" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "paidOnline" BOOLEAN NOT NULL DEFAULT false,
    "notifyWhenReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("address", "createdAt", "deliveryType", "id", "name", "notes", "paidOnline", "phone", "reference", "status", "totalPrice") SELECT "address", "createdAt", "deliveryType", "id", "name", "notes", "paidOnline", "phone", "reference", "status", "totalPrice" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
