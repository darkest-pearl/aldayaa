import { prisma } from '../../../../lib/prisma';
import { success, failure } from '../../../../lib/api-response';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference');

  if (!reference) {
    return failure('Reference is required', 400);
  }

  const order = await prisma.order.findUnique({ where: { reference } });

  if (!order) {
    return failure('Order not found', 404);
  }

  return success({
    reference: order.reference,
    status: order.status,
    orderType: order.deliveryType,
    address: order.address,
    createdAt: order.createdAt,
  });
}