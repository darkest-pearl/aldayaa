-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DEMO',
    "type" TEXT NOT NULL DEFAULT 'DEMO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- Seed the tenant anchor used by the current single demo restaurant.
INSERT INTO "Restaurant" (
    "id",
    "name",
    "slug",
    "status",
    "type",
    "notes",
    "createdAt",
    "updatedAt"
)
VALUES (
    'demo-restaurant',
    'Demo Restaurant',
    'demo-restaurant',
    'DEMO',
    'DEMO',
    'Seeded tenant anchor for the current demo restaurant. Existing operations are not tenant-scoped yet.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "status" = EXCLUDED."status",
    "type" = EXCLUDED."type",
    "updatedAt" = CURRENT_TIMESTAMP;
