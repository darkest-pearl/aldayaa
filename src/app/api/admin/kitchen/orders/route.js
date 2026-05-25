export const dynamic = "force-dynamic";
import { requireAdmin } from '../../../../../lib/auth';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../../../lib/features';
import { prisma } from '../../../../../lib/prisma';
import { ORDER_STATUSES } from '../../../../../lib/order-status';
import { getRestaurantProfile } from '../../../../../lib/restaurant-profile';

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const profile = await getRestaurantProfile();

    if (!isFeatureEnabled(profile.enabledFeatures, FEATURE_KEYS.KITCHEN_QUEUE)) {
      return failure('Kitchen queue is not enabled', 400);
    }

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
