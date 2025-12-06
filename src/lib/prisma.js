import { PrismaClient } from "@prisma/client";

/**
 * Reuse Prisma client across hot reloads to avoid exhausting database connections.
 * @type {PrismaClient}
 */
const globalForPrisma = globalThis;

/**
 * Singleton Prisma client instance.
 * Falls back to the cached instance in development to prevent multiple clients.
 */
export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}