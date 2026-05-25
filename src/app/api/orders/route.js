export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { handleApiError, success, failure } from '../../../lib/api-response';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../lib/features';
import { generateReference } from "../../../lib/reference";
import { getRestaurantProfile } from '../../../lib/restaurant-profile';
import { sendWhatsAppMessage } from "../../../lib/whatsapp";
import {
  ORDER_CONTEXTS,
  ORDER_SOURCES,
  ORDER_STATUSES,
  canTransitionOrderStatus,
  getOrderStatusLabel,
  isValidOrderStatus,
} from '../../../lib/order-status';

const itemSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
});

const orderSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(4),
  deliveryType: z.enum(['DELIVERY', 'PICKUP']),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
  paidOnline: z.boolean().optional(),
  notifyWhenReady: z.boolean().optional(),
  tableSlug: z.string().trim().min(1).max(80).optional().nullable(),
  table: z.string().trim().min(1).max(80).optional().nullable(),
  tableToken: z.string().trim().min(8).max(200).optional().nullable(),
});

const updateSchema = z.object({
  id: z.string().min(3),
  status: z.string().refine(isValidOrderStatus, 'Invalid order status'),
});
const deleteSchema = z.object({ id: z.string().min(3) });

function getRequestedTableSlug(orderData) {
  const rawSlug = orderData.tableSlug || orderData.table || '';
  return typeof rawSlug === 'string' ? rawSlug.trim() : '';
}

function getRequestedTableToken(orderData) {
  return typeof orderData.tableToken === 'string' ? orderData.tableToken.trim() : '';
}

/* ----------------------------- GET (Admin Only) ----------------------------- */
export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true, table: true },
    });
    return success({ orders });
  } catch (error) {
    console.error('Orders GET error:', error);
    return handleApiError(error);
  }
}

/* ----------------------------- POST (Public) ----------------------------- */
/** 
 * Places a new order:
 * - Validates fields
 * - Generates a unique reference number
 * - Stores reference in the DB
 * - Returns reference to user
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const requestedTableSlugFromBody = getRequestedTableSlug(body);
    // Table-context orders reuse PICKUP until the schema supports a dedicated DINE_IN mode.
    const orderType = requestedTableSlugFromBody ? 'PICKUP' : body.deliveryType;
    const notifyWhenReady =
      orderType === "DELIVERY" ? false : Boolean(body.notifyWhenReady);

    // validate incoming data
    const parsed = orderSchema.safeParse({
      ...body,
      deliveryType: orderType,
      notifyWhenReady,
    });
    if (!parsed.success) {
      return failure("Invalid order data", 400, { details: parsed.error.flatten() });
    }

    const requestedTableSlug = getRequestedTableSlug(parsed.data);
    const requestedTableToken = getRequestedTableToken(parsed.data);
    let tableContext = null;

    if (requestedTableSlug) {
      if (!requestedTableToken) {
        return failure('Table ordering is not available for this table', 400);
      }

      const profile = await getRestaurantProfile();
      if (!isFeatureEnabled(profile.enabledFeatures, FEATURE_KEYS.TABLE_QR_ORDERING)) {
        return failure('Table ordering is not available', 400);
      }

      tableContext = await prisma.restaurantTable.findFirst({
        where: { slug: requestedTableSlug, qrToken: requestedTableToken, isActive: true },
        select: { id: true, label: true, slug: true },
      });

      if (!tableContext) {
        return failure('Table ordering is not available for this table', 400);
      }
    }
    const hasTableContext = Boolean(tableContext);

    if (
      !hasTableContext && parsed.data.deliveryType === 'DELIVERY' &&
      (!parsed.data.address || !parsed.data.address.trim())
    ) {
      return failure('Delivery address is required for delivery orders', 400);
    }

    const itemIds = [...new Set(parsed.data.items.map((item) => item.id))];
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, price: true, isAvailable: true },
    });
    const menuItemsById = new Map(menuItems.map((item) => [item.id, item]));
    const missingItem = parsed.data.items.find((item) => !menuItemsById.has(item.id));
    if (missingItem) {
      return failure("One or more menu items are no longer available", 400);
    }

    const unavailableItem = parsed.data.items.find((item) => !menuItemsById.get(item.id)?.isAvailable);
    if (unavailableItem) {
      return failure("One or more menu items are no longer available", 400);
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

    const totalPrice = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // generate UNIQUE reference
    const reference = generateReference();

    // create order
    const order = await prisma.order.create({
      data: {
        reference, // important!
        name: parsed.data.name,
        phone: parsed.data.phone,
        deliveryType: parsed.data.deliveryType,
        address: hasTableContext
          ? null
          : parsed.data.deliveryType === "DELIVERY"
            ? parsed.data.address.trim()
            : null,
        notes: parsed.data.notes || null,
        paidOnline: Boolean(parsed.data.paidOnline),
        notifyWhenReady: hasTableContext ? false : notifyWhenReady,
        totalPrice,
        tableId: tableContext?.id || null,
        tableLabel: tableContext?.label || null,
        tableSlug: tableContext?.slug || null,
        orderContext: tableContext ? ORDER_CONTEXTS.TABLE : ORDER_CONTEXTS.STANDARD,
        orderSource: ORDER_SOURCES.CUSTOMER,
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    });

    return success({
      order,
      reference, // send to client for display
    });
  } catch (error) {
    console.error("Order POST error:", error);
    return failure("Unable to place order", 500);
  }
}

/* ----------------------------- PUT (Admin Only) ----------------------------- */
export async function PUT(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success)
      return failure('Invalid order update', 400, {
        details: parsed.error.flatten(),
      });

    const existingOrder = await prisma.order.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true },
    });

    if (!existingOrder) {
      return failure('Order not found', 404);
    }

    if (!canTransitionOrderStatus(existingOrder.status, parsed.data.status)) {
      return failure(
        `Cannot move order from ${getOrderStatusLabel(existingOrder.status)} to ${getOrderStatusLabel(parsed.data.status)}.`,
        400
      );
    }

    const order = await prisma.order.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });

    if (
      existingOrder.status !== ORDER_STATUSES.COMPLETED &&
      order.status === ORDER_STATUSES.COMPLETED &&
      order.deliveryType === "PICKUP" &&
      order.notifyWhenReady === true &&
      order.phone
    ) {
      try {
        await sendWhatsAppMessage(
          order.phone,
          `Your order ${order.reference} is ready for pickup at Al Dayaa Al Shamiah.`
        );
      } catch (err) {
        console.error('Failed to send WhatsApp notification:', err);
      }
    }

    return success({
      reference: order.reference,
      order,
    });

  } catch (error) {
    return handleApiError(error);
  }
}

/* ----------------------------- DELETE (Admin Only) ----------------------------- */
export async function DELETE(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) return failure('Invalid order id', 400);
    

    await prisma.orderItem.deleteMany({ where: { orderId: parsed.data.id } });
    await prisma.order.delete({ where: { id: parsed.data.id } });

    return success({});
  } catch (error) {
    return handleApiError(error);
  }
}
