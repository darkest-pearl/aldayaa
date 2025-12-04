import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { handleApiError, success, failure } from '../../../lib/api-response';
import { generateReference } from "../../../lib/reference"; 

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().int().min(1),
});

const orderSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(4),
  deliveryType: z.enum(['DELIVERY', 'PICKUP']),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
  paidOnline: z.boolean().optional(),
});

const updateSchema = z.object({ id: z.string().min(3), status: z.string() });
const deleteSchema = z.object({ id: z.string().min(3) });

/* ----------------------------- GET (Admin Only) ----------------------------- */
export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return success({ orders });
  } catch (error) {
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
    const orderType = body.deliveryType;

    if (
      orderType === 'DELIVERY' &&
      (!body.address || !body.address.trim())
    ) {
      return failure('Delivery address is required for delivery orders', 400);
    }

    // validate incoming data
    const parsed = orderSchema.safeParse({
      ...body,
      items: (body.items || []).map((i) => ({ ...i, price: Number(i.price) })),
    });
    if (!parsed.success) {
      return failure("Invalid order data", 400, { details: parsed.error.flatten() });
    }

    // compute total
    const totalPrice = parsed.data.items.reduce(
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
        address:
          orderType === "DELIVERY"
            ? body.address.trim()
            : null,
        notes: parsed.data.notes || null,
        paidOnline: Boolean(parsed.data.paidOnline),
        totalPrice,
        items: {
          create: parsed.data.items.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            menuItemId: item.id,
          })),
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

    const order = await prisma.order.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });

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
