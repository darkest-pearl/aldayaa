export const dynamic = "force-dynamic";
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success } from '../../../../lib/api-response';

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const stats = await getStats();
    return success({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return {
    reservationsToday: await prisma.reservation.count({
      where: {
        date: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    }),
    ordersToday: await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    }),
    menuCount: await prisma.menuItem.count(),
    photoCount: await prisma.photo.count(),
  };
}
