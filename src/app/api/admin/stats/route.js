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
  return {
    reservationsToday: await prisma.reservation.count(),
    ordersToday: await prisma.order.count(),
    menuCount: await prisma.menuItem.count(),
    photoCount: await prisma.photo.count(),
  };
}
