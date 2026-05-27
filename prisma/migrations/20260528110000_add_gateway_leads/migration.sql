CREATE TABLE "GatewayLead" (
    "id" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "interestedModules" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GatewayLead_status_idx" ON "GatewayLead"("status");
CREATE INDEX "GatewayLead_createdAt_idx" ON "GatewayLead"("createdAt");
