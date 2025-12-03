-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "openingTime" TEXT NOT NULL,
    "closingTime" TEXT NOT NULL,
    "allowCancelPaid" BOOLEAN NOT NULL DEFAULT false,
    "allowCancelInProgress" BOOLEAN NOT NULL DEFAULT false,
    "cancellationFee" REAL NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "deliveryType" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "totalPrice" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "paidOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("address", "createdAt", "deliveryType", "id", "name", "notes", "phone", "status", "totalPrice") SELECT "address", "createdAt", "deliveryType", "id", "name", "notes", "phone", "status", "totalPrice" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
