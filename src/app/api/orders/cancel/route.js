export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { getRestaurantSettings } from '../../../../lib/restaurant-settings';
import { success, failure } from '../../../../lib/api-response';

const cancelSchema = z.object({ id: z.string().min(3) });

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid order reference', 400);
    }

    const { id } = parsed.data;

    // Find order by reference (assuming DB column is `reference`)
    const order = await prisma.order.findUnique({
      where: { reference: id },
    });

    if (!order) return failure('Order not found', 404);

    const settings = await getRestaurantSettings();
    const now = new Date();
    const minutesSincePlaced = (now - order.createdAt) / 60000;

    if (order.status === 'COMPLETED') return failure('Order already completed', 400);
    if (order.status === 'CANCELLED') return failure('Order already cancelled', 400);
    if (order.paidOnline && !settings.allowCancelPaid) return failure('Paid orders cannot be canceled', 400);
    if (order.status === 'IN_PROGRESS' && !settings.allowCancelInProgress)
      return failure('Order already in progress', 400);
    if (minutesSincePlaced > 30) return failure('Orders can only be canceled within 30 minutes', 400);

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
    });

    const data = { cancelled: true };
    if (settings.cancellationFee > 0) {
      data.fee = settings.cancellationFee;
    }

    return success(data);
  } catch (error) {
    console.error('Order cancellation error:', error);
    return failure('Unable to cancel order', 500);
  }
}
