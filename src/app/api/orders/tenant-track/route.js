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
      select: { id: true },
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

  return { restaurantId: restaurant.id };
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
        reference: true,
        status: true,
        createdAt: true,
        deliveryType: true,
        tableLabel: true,
        tableSlug: true,
      },
    });

    if (!order) {
      return failure('Order not found', 404);
    }

    return success({
      order: normalizeTenantPublicOrder(order),
    });
  } catch (error) {
    console.error('Tenant order tracking error:', error);
    return failure('Unable to track order', 500);
  }
}
