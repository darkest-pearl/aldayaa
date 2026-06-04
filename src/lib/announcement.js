export const dynamic = "force-dynamic";
import { prisma } from "./prisma";
import { withDemoRestaurantWhere } from "./restaurants";

/**
 * Retrieve the currently active announcement.
 * @returns {Promise<import("@prisma/client").Announcement | null>}
 */
export async function getActiveAnnouncement() {
  return prisma.announcement.findFirst({
    where: withDemoRestaurantWhere({ isActive: true }),
    orderBy: [
      { restaurantId: "asc" },
      { updatedAt: "desc" },
    ],
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
