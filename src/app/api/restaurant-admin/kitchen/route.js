export const dynamic = 'force-dynamic';

import { failure, handleApiError, success } from '../../../../lib/api-response';
import {
  ORDER_CONTEXTS,
  ORDER_STATUSES,
  isValidOrderStatus,
} from '../../../../lib/order-status';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';
import { normalizeTenantOrders, TENANT_ORDER_INCLUDE } from '../../../../lib/tenant-orders';

const ACTIVE_STATUS_FILTER = Object.freeze([ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED]);

function getKitchenQueueCounters(orders = []) {
  return orders.reduce(
    (counts, order) => {
      counts.activeOrders += 1;
      counts.byStatus[order.status] = (counts.byStatus[order.status] || 0) + 1;
      if ((order.orderContext || ORDER_CONTEXTS.STANDARD) === ORDER_CONTEXTS.TABLE) {
        counts.tableOrders += 1;
      }
      return counts;
    },
    {
      activeOrders: 0,
      tableOrders: 0,
      byStatus: {
        [ORDER_STATUSES.NEW]: 0,
        [ORDER_STATUSES.IN_PROGRESS]: 0,
      },
    },
  );
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || '';
    const orderContextFilter = searchParams.get('orderContext') || '';

    if (statusFilter && !isValidOrderStatus(statusFilter)) {
      return failure('Invalid kitchen status filter', 400);
    }

    if (orderContextFilter && !Object.values(ORDER_CONTEXTS).includes(orderContextFilter)) {
      return failure('Invalid kitchen order context filter', 400);
    }

    const where = {
      restaurantId: staff.restaurantId,
      status: { notIn: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED] },
    };

    if (statusFilter) {
      if (ACTIVE_STATUS_FILTER.includes(statusFilter)) {
        return success({
          orders: [],
          counters: getKitchenQueueCounters([]),
          staffRole: staff.role,
        });
      }
      where.status = statusFilter;
    }

    if (orderContextFilter) {
      where.orderContext = orderContextFilter;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { createdAt: 'asc' },
      ],
      include: TENANT_ORDER_INCLUDE,
    });

    const activeOrdersForCounters = await prisma.order.findMany({
      where: {
        restaurantId: staff.restaurantId,
        status: { notIn: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED] },
      },
      select: {
        status: true,
        orderContext: true,
      },
    });

    return success({
      orders: normalizeTenantOrders(orders),
      counters: getKitchenQueueCounters(activeOrdersForCounters),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
