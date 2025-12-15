/*
  Warnings:

  - You are about to drop the `_MenuItemToOrderItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[reference]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "_MenuItemToOrderItem" DROP CONSTRAINT "_MenuItemToOrderItem_A_fkey";

-- DropForeignKey
ALTER TABLE "_MenuItemToOrderItem" DROP CONSTRAINT "_MenuItemToOrderItem_B_fkey";

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "notifyWhenReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reference" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "menuItemId" TEXT;

-- DropTable
DROP TABLE "_MenuItemToOrderItem";

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "openingTime" TEXT NOT NULL,
    "closingTime" TEXT NOT NULL,
    "allowCancelPaid" BOOLEAN NOT NULL DEFAULT false,
    "allowCancelInProgress" BOOLEAN NOT NULL DEFAULT false,
    "cancellationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workingHoursByDay" TEXT,
    "displayHours" TEXT,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItem_isSignature_idx" ON "MenuItem"("isSignature");

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
