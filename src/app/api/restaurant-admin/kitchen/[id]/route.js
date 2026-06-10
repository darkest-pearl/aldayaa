export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import {
  canTransitionOrderStatus,
  getOrderStatusLabel,
  isValidOrderStatus,
} from '../../../../../lib/order-status';
import { prisma } from '../../../../../lib/prisma';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import { normalizeTenantOrder, TENANT_ORDER_INCLUDE } from '../../../../../lib/tenant-orders';

const updateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  status: z.string().refine(isValidOrderStatus, 'Invalid order status'),
});

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid kitchen order update', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { id: params.id, restaurantId: staff.restaurantId },
        select: { id: true, status: true },
      });

      if (!existingOrder) {
        throw apiError('Kitchen order not found', 404);
      }

      if (!canTransitionOrderStatus(existingOrder.status, parsed.data.status)) {
        throw apiError(
          `Cannot move kitchen order from ${getOrderStatusLabel(existingOrder.status)} to ${getOrderStatusLabel(parsed.data.status)}.`,
          400,
        );
      }

      const updated = await tx.order.updateMany({
        where: { id: params.id, restaurantId: staff.restaurantId },
        data: { status: parsed.data.status },
      });

      if (updated.count !== 1) {
        throw apiError('Kitchen order not found', 404);
      }

      const order = await tx.order.findFirst({
        where: { id: params.id, restaurantId: staff.restaurantId },
        include: TENANT_ORDER_INCLUDE,
      });

      if (!order) {
        throw apiError('Kitchen order not found', 404);
      }

      return order;
    });

    return success({ order: normalizeTenantOrder(order) });
  } catch (error) {
    return handleApiError(error);
  }
}
