export const dynamic = "force-dynamic";
import { requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import { ORDER_STATUSES } from '../../../../../lib/order-status';

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: [ORDER_STATUSES.NEW, ORDER_STATUSES.IN_PROGRESS],
          notIn: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED],
        },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'asc' },
      ],
      include: { items: true, table: true },
    });

    return success({ orders });
  } catch (error) {
    return handleApiError(error);
  }
}
