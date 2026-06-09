export const dynamic = 'force-dynamic';

import { handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import { normalizeReservations } from '../../../../lib/reservations';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const reservations = await prisma.reservation.findMany({
      where: { restaurantId: staff.restaurantId },
      orderBy: [{ date: 'asc' }, { time: 'asc' }, { createdAt: 'desc' }],
    });

    return success({
      reservations: normalizeReservations(reservations),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
