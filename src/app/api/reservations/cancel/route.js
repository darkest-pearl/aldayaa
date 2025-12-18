export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { success, failure } from '../../../../lib/api-response';

const cancelSchema = z.object({
  reference: z.string().min(3),
  phone: z.string().optional(),
});

function parseReservationDateTime(date, time) {
  if (!date || !time) return null;
  const baseDate = date instanceof Date ? new Date(date) : new Date(`${date}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return null;

  const [hours, minutes] = `${time}`.split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  baseDate.setHours(hours, minutes, 0, 0);

  return Number.isNaN(baseDate.getTime()) ? null : baseDate;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid reservation reference', 400);
    }

    const { reference, phone } = parsed.data;

    const reservation = await prisma.reservation.findUnique({ where: { id: reference } });

    if (!reservation) return failure('Reservation not found', 404);

    if (phone && reservation.phone !== phone) {
      return failure('Phone number does not match reservation', 400);
    }

    if (reservation.status === 'CANCELLED') {
      return failure('Reservation already cancelled', 400);
    }

    const reservationDateTime = parseReservationDateTime(reservation.date, reservation.time);
    if (reservationDateTime && reservationDateTime < new Date()) {
      return failure('Past reservations cannot be cancelled', 400);
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED' },
    });

    return success({ cancelled: true });
  } catch (error) {
    console.error('Reservation cancellation error:', error);
    return failure('Unable to cancel reservation', 500);
  }
}