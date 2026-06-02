ALTER TABLE "GatewayLead"
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "lastContactedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "GatewayLead_lastContactedAt_idx" ON "GatewayLead"("lastContactedAt");
