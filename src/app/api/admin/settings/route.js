import { z } from 'zod';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import { getRestaurantSettings } from '../../../../lib/restaurant-settings';

const settingsSchema = z.object({
  openingTime: z.string().min(1),
  closingTime: z.string().min(1),
  allowCancelPaid: z.boolean().optional(),
  allowCancelInProgress: z.boolean().optional(),
  cancellationFee: z.number().min(0).optional(),
});

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const settings = await getRestaurantSettings();
    return success({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const body = await request.json();
    const parsed = settingsSchema.safeParse({
      ...body,
      cancellationFee: Number(body.cancellationFee ?? 0),
    });

    if (!parsed.success) {
      return failure('Invalid settings payload', 400, { details: parsed.error.flatten() });
    }

    await getRestaurantSettings();

    const settings = await prisma.restaurantSettings.update({
      where: { id: 1 },
      data: {
        openingTime: parsed.data.openingTime,
        closingTime: parsed.data.closingTime,
        allowCancelPaid: Boolean(parsed.data.allowCancelPaid),
        allowCancelInProgress: Boolean(parsed.data.allowCancelInProgress),
        cancellationFee: parsed.data.cancellationFee ?? 0,
      },
    });

    return success({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}