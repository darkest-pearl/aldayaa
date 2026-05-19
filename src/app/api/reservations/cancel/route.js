export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { success, failure } from '../../../../lib/api-response';

const cancelSchema = z.object({
  reference: z.string().trim().min(3),
  phone: z.string().trim().min(4),
});

const RESTAURANT_TIME_ZONE = 'Asia/Dubai';

function formatDubaiDateOnly(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RESTAURANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function parseReservationDateTime(date, time) {
  if (!date || !time) return null;
  const dateOnly = formatDubaiDateOnly(date);
  if (!dateOnly) return null;

  const [hours, minutes] = `${time}`.split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const reservationDateTime = new Date(`${dateOnly}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+04:00`);
  return Number.isNaN(reservationDateTime.getTime()) ? null : reservationDateTime;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Reservation reference and phone number are required', 400);
    }

    const { reference, phone } = parsed.data;

    const reservation = await prisma.reservation.findUnique({ where: { reference } });

    if (!reservation) return failure('Reservation not found', 404);

    if (reservation.phone !== phone) {
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
