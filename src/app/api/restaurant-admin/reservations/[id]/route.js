export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import { normalizeReservation, RESERVATION_STATUSES } from '../../../../../lib/reservations';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';

const updateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  status: z.enum(RESERVATION_STATUSES),
});

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid reservation update', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await prisma.reservation.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });

    if (!existing) return failure('Reservation not found', 404);

    const reservation = await prisma.reservation.update({
      where: { id: params.id },
      data: { status: parsed.data.status },
    });

    return success({ reservation: normalizeReservation(reservation) });
  } catch (error) {
    return handleApiError(error);
  }
}
