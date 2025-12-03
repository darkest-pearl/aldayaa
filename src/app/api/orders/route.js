import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { handleApiError, success, failure } from '../../../lib/api-response';

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
});

const updateSchema = z.object({ id: z.string().min(3), status: z.string() });
const deleteSchema = z.object({ id: z.string().min(3) });

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true } });
    return success({ orders });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = orderSchema.safeParse({ ...body, items: (body.items || []).map((i) => ({ ...i, price: Number(i.price) })) });
    if (!parsed.success) return failure('Invalid order data', 400, { details: parsed.error.flatten() });

    const totalPrice = parsed.data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await prisma.order.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        deliveryType: parsed.data.deliveryType,
        address: parsed.data.deliveryType === 'DELIVERY' ? parsed.data.address : null,
        notes: parsed.data.notes || null,
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
    return success({ order });
  } catch (error) {
    return failure('Unable to place order', 500);
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid order update', 400, { details: parsed.error.flatten() });

    const order = await prisma.order.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
    return success({ order });
  } catch (error) {
    return handleApiError(error);
  }
}

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