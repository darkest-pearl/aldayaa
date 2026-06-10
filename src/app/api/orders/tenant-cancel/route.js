export const dynamic = "force-dynamic";

import { z } from 'zod';
import { failure, success } from '../../../../lib/api-response';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../../lib/features';
import { prisma } from '../../../../lib/prisma';
import { DEMO_RESTAURANT_SLUG } from '../../../../lib/restaurants';

const tenantOrderSupportSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  reference: z.string().trim().min(3),
  phone: z.string().trim().min(4),
});

function normalizeTenantOrderSupportSlug(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeTenantPublicOrder(order = {}) {
  return {
    reference: order.reference,
    status: order.status,
    createdAt: order.createdAt,
    deliveryType: order.deliveryType,
    tableLabel: order.tableLabel || null,
    tableSlug: order.tableSlug || null,
  };
}

async function resolveTenantOrderSupportContext(restaurantSlug) {
  const normalizedSlug = normalizeTenantOrderSupportSlug(restaurantSlug);

  if (!normalizedSlug || normalizedSlug === DEMO_RESTAURANT_SLUG) {
    return {
      error: failure('Order support is not available for this restaurant', 404),
    };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: normalizedSlug },
    select: { id: true, status: true },
  });

  if (!restaurant || restaurant.status === 'ARCHIVED') {
    return {
      error: failure('Order support is not available for this restaurant', 404),
    };
  }

  const [profile, settings] = await Promise.all([
    prisma.restaurantProfile.findUnique({
      where: { restaurantId: restaurant.id },
      select: { id: true, enabledFeatures: true },
    }),
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: restaurant.id },
      select: {
        id: true,
        allowCancelPaid: true,
        allowCancelInProgress: true,
        cancellationFee: true,
      },
    }),
  ]);

  if (!profile || !settings) {
    return {
      error: failure('Restaurant order support is not initialized yet', 404),
    };
  }

  if (!isFeatureEnabled(profile.enabledFeatures, FEATURE_KEYS.ONLINE_ORDERING)) {
    return {
      error: failure('Online ordering is not available for this restaurant', 400),
    };
  }

  return { restaurantId: restaurant.id, settings };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = tenantOrderSupportSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Restaurant slug, reference, and phone are required', 400, {
        details: parsed.error.flatten(),
      });
    }

    const context = await resolveTenantOrderSupportContext(parsed.data.restaurantSlug);
    if (context.error) return context.error;

    const order = await prisma.order.findFirst({
      where: { restaurantId: context.restaurantId, reference: parsed.data.reference, phone: parsed.data.phone },
      select: {
        id: true,
        reference: true,
        status: true,
        createdAt: true,
        deliveryType: true,
        paidOnline: true,
        tableLabel: true,
        tableSlug: true,
      },
    });

    if (!order) return failure('Order not found', 404);

    const now = new Date();
    const minutesSincePlaced = (now - order.createdAt) / 60000;

    if (order.status === 'COMPLETED') return failure('Order already completed', 400);
    if (order.status === 'CANCELLED') return failure('Order already cancelled', 400);
    if (order.paidOnline && !context.settings.allowCancelPaid) return failure('Paid orders cannot be canceled', 400);
    if (order.status === 'IN_PROGRESS' && !context.settings.allowCancelInProgress) {
      return failure('Order already in progress', 400);
    }
    if (minutesSincePlaced > 30) return failure('Orders can only be canceled within 30 minutes', 400);

    const updated = await prisma.order.updateMany({
      where: { id: order.id, restaurantId: context.restaurantId },
      data: { status: 'CANCELLED' },
    });

    if (updated.count !== 1) return failure('Order not found', 404);

    const cancelledOrder = await prisma.order.findFirst({
      where: { id: order.id, restaurantId: context.restaurantId },
      select: {
        reference: true,
        status: true,
        createdAt: true,
        deliveryType: true,
        tableLabel: true,
        tableSlug: true,
      },
    });

    const data = {
      cancelled: true,
      order: normalizeTenantPublicOrder(cancelledOrder || { ...order, status: 'CANCELLED' }),
    };
    if (context.settings.cancellationFee > 0) {
      data.fee = context.settings.cancellationFee;
    }

    return success(data);
  } catch (error) {
    console.error('Tenant order cancellation error:', error);
    return failure('Unable to cancel order', 500);
  }
}
