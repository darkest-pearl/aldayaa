export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import { normalizeReservation, RESERVATION_STATUSES } from '../../../../../lib/reservations';
import { requireRestaurantStaffAccess } from '../../../../../lib/restaurant-staff-access';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../../lib/tenant-audit';

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
    const existingReservation = await prisma.reservation.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true, status: true, reference: true },
    });
    if (!existingReservation) return failure('Reservation not found', 404);

    const updated = await prisma.reservation.updateMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
      data: { status: parsed.data.status },
    });

    if (updated.count !== 1) return failure('Reservation not found', 404);

    const reservation = await prisma.reservation.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });

    if (!reservation) return failure('Reservation not found', 404);

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.RESERVATION_STATUS_UPDATED,
      entityType: 'RESERVATION',
      entityId: reservation.id,
      summary: `Updated reservation ${reservation.reference} status`,
      metadata: {
        reference: reservation.reference,
        beforeStatus: existingReservation.status,
        afterStatus: reservation.status,
      },
    });

    return success({ reservation: normalizeReservation(reservation) });
  } catch (error) {
    return handleApiError(error);
  }
}
