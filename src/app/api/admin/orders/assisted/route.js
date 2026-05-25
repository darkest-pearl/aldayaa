export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../../../lib/features';
import { getRestaurantProfile } from '../../../../../lib/restaurant-profile';
import { generateReference } from '../../../../../lib/reference';

const itemSchema = z.object({
  id: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
});

const assistedOrderSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  tableId: z.string().trim().min(1).optional().nullable(),
  tableSlug: z.string().trim().min(1).max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(itemSchema).min(1),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(request) {
  try {
    const admin = await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const profile = await getRestaurantProfile();

    if (!isFeatureEnabled(profile.enabledFeatures, FEATURE_KEYS.WAITER_ASSISTED_ORDERING)) {
      return failure('Waiter-assisted ordering is not enabled', 400);
    }

    const body = await request.json();
    const parsed = assistedOrderSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid assisted order payload', 400, { details: parsed.error.flatten() });
    }

    const requestedTableId = cleanOptionalString(parsed.data.tableId);
    const requestedTableSlug = cleanOptionalString(parsed.data.tableSlug);
    let tableContext = null;

    if (requestedTableId || requestedTableSlug) {
      tableContext = await prisma.restaurantTable.findFirst({
        where: {
          ...(requestedTableId ? { id: requestedTableId } : {}),
          ...(requestedTableSlug ? { slug: requestedTableSlug } : {}),
          isActive: true,
        },
        select: { id: true, label: true, slug: true },
      });

      if (!tableContext) {
        return failure('Table ordering is not available for this table', 400);
      }
    }

    const itemIds = [...new Set(parsed.data.items.map((item) => item.id))];
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, price: true, isAvailable: true },
    });
    const menuItemsById = new Map(menuItems.map((item) => [item.id, item]));

    const missingItem = parsed.data.items.find((item) => !menuItemsById.has(item.id));
    if (missingItem) {
      return failure('One or more menu items are no longer available', 400);
    }

    const unavailableItem = parsed.data.items.find((item) => !menuItemsById.get(item.id)?.isAvailable);
    if (unavailableItem) {
      return failure('One or more menu items are no longer available', 400);
    }

    const orderItems = parsed.data.items.map((item) => {
      const menuItem = menuItemsById.get(item.id);
      return {
        itemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        menuItemId: menuItem.id,
      };
    });

    const totalPrice = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const reference = generateReference();

    const order = await prisma.order.create({
      data: {
        reference,
        name: parsed.data.name,
        phone: cleanOptionalString(parsed.data.phone) || '',
        deliveryType: 'PICKUP',
        address: null,
        notes: cleanOptionalString(parsed.data.notes),
        paidOnline: false,
        notifyWhenReady: false,
        totalPrice,
        tableId: tableContext?.id || null,
        tableLabel: tableContext?.label || null,
        tableSlug: tableContext?.slug || null,
        orderContext: tableContext ? 'TABLE' : 'STANDARD',
        orderSource: 'STAFF_ASSISTED',
        createdByAdminId: admin.id,
        createdByAdminEmail: admin.email,
        items: {
          create: orderItems,
        },
      },
      include: { items: true, table: true },
    });

    return success({ order, reference });
  } catch (error) {
    return handleApiError(error);
  }
}
