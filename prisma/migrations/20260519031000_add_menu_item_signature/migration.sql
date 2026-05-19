ALTER TABLE "MenuItem" ADD COLUMN "isSignature" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "MenuItem_isSignature_idx" ON "MenuItem"("isSignature");

ALTER TABLE "Order" ALTER COLUMN "reference" DROP DEFAULT;
