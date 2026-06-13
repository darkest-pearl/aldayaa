CREATE TABLE "RestaurantAuditLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "actorRestaurantUserId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestaurantAuditLog_restaurantId_idx" ON "RestaurantAuditLog"("restaurantId");
CREATE INDEX "RestaurantAuditLog_actorRestaurantUserId_idx" ON "RestaurantAuditLog"("actorRestaurantUserId");
CREATE INDEX "RestaurantAuditLog_action_idx" ON "RestaurantAuditLog"("action");
CREATE INDEX "RestaurantAuditLog_entityType_idx" ON "RestaurantAuditLog"("entityType");
CREATE INDEX "RestaurantAuditLog_entityId_idx" ON "RestaurantAuditLog"("entityId");
CREATE INDEX "RestaurantAuditLog_createdAt_idx" ON "RestaurantAuditLog"("createdAt");

ALTER TABLE "RestaurantAuditLog" ADD CONSTRAINT "RestaurantAuditLog_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
