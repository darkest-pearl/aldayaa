ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "reference" TEXT;

UPDATE "Reservation"
SET "reference" = CONCAT('RES-', "id")
WHERE "reference" IS NULL OR "reference" = '';

ALTER TABLE "Reservation" ALTER COLUMN "reference" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_reference_key" ON "Reservation"("reference");
