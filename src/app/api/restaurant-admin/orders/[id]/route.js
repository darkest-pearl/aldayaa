export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../../lib/tenant-audit';
import {
  canTransitionOrderStatus,
  getOrderStatusLabel,
  isValidOrderStatus,
} from '../../../../../lib/order-status';
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
      return failure('Invalid order update', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const { order, beforeStatus } = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { id: params.id, restaurantId: staff.restaurantId },
        select: { id: true, status: true },
      });

      if (!existingOrder) {
        throw apiError('Order not found', 404);
      }

      if (!canTransitionOrderStatus(existingOrder.status, parsed.data.status)) {
        throw apiError(
          `Cannot move order from ${getOrderStatusLabel(existingOrder.status)} to ${getOrderStatusLabel(parsed.data.status)}.`,
          400
        );
      }

      const updated = await tx.order.updateMany({
        where: { id: params.id, restaurantId: staff.restaurantId, status: existingOrder.status },
        data: { status: parsed.data.status },
      });

      if (updated.count !== 1) {
        throw apiError('Order not found', 404);
      }

      const order = await tx.order.findFirst({
        where: { id: params.id, restaurantId: staff.restaurantId },
        include: TENANT_ORDER_INCLUDE,
      });

      if (!order) {
        throw apiError('Order not found', 404);
      }

      return { order, beforeStatus: existingOrder.status };
    });

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.ORDER_STATUS_UPDATED,
      entityType: 'ORDER',
      entityId: order.id,
      summary: `Updated order ${order.reference || order.id} status`,
      metadata: {
        reference: order.reference,
        beforeStatus,
        afterStatus: order.status,
      },
    });

    return success({ order: normalizeTenantOrder(order) });
  } catch (error) {
    return handleApiError(error);
  }
}
