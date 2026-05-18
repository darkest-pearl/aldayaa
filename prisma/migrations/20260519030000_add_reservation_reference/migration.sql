ALTER TABLE "Reservation" ADD COLUMN "reference" TEXT;

UPDATE "Reservation"
SET "reference" = CONCAT('RES-', "id")
WHERE "reference" IS NULL;

ALTER TABLE "Reservation" ALTER COLUMN "reference" SET NOT NULL;

CREATE UNIQUE INDEX "Reservation_reference_key" ON "Reservation"("reference");
