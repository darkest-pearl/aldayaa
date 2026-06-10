export const dynamic = 'force-dynamic';

import { handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';
import { normalizeTenantOrders, TENANT_ORDER_INCLUDE } from '../../../../lib/tenant-orders';

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const orders = await prisma.order.findMany({
      where: { restaurantId: staff.restaurantId },
      orderBy: { createdAt: 'desc' },
      include: TENANT_ORDER_INCLUDE,
    });

    return success({
      orders: normalizeTenantOrders(orders),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
