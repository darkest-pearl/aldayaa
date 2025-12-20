export const dynamic = "force-dynamic";
import { prisma } from "./prisma";

/**
 * Retrieve the currently active announcement.
 * @returns {Promise<import("@prisma/client").Announcement | null>}
 */
export async function getActiveAnnouncement() {
  return prisma.announcement.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Retrieve the latest announcement for admin editing.
 * @returns {Promise<import("@prisma/client").Announcement | null>}
 */
export async function getLatestAnnouncement() {
  return prisma.announcement.findFirst({
    orderBy: { updatedAt: "desc" },
  });
}