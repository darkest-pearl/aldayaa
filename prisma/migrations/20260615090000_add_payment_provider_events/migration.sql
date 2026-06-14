CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMode" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "idempotencyKey" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "restaurantId" TEXT,

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProviderEvent_provider_providerMode_providerEventId_key"
ON "PaymentProviderEvent"("provider", "providerMode", "providerEventId");

CREATE INDEX "PaymentProviderEvent_provider_idx" ON "PaymentProviderEvent"("provider");
CREATE INDEX "PaymentProviderEvent_providerMode_idx" ON "PaymentProviderEvent"("providerMode");
CREATE INDEX "PaymentProviderEvent_eventType_idx" ON "PaymentProviderEvent"("eventType");
CREATE INDEX "PaymentProviderEvent_status_idx" ON "PaymentProviderEvent"("status");
CREATE INDEX "PaymentProviderEvent_restaurantId_idx" ON "PaymentProviderEvent"("restaurantId");
CREATE INDEX "PaymentProviderEvent_relatedEntityType_relatedEntityId_idx"
ON "PaymentProviderEvent"("relatedEntityType", "relatedEntityId");
CREATE INDEX "PaymentProviderEvent_receivedAt_idx" ON "PaymentProviderEvent"("receivedAt");
CREATE INDEX "PaymentProviderEvent_idempotencyKey_idx" ON "PaymentProviderEvent"("idempotencyKey");

ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
