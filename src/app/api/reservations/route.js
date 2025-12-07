export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { DAYS_OF_WEEK, getRestaurantSettings, normalizeWorkingHoursByDay } from '../../../lib/restaurant-settings';
import { handleApiError, success, failure } from '../../../lib/api-response';

const createSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(4),
  email: z.string().email().optional().nullable(),
  date: z.string().min(1),
  time: z.string().min(1),
  guests: z.number().int().min(1),
  specialRequests: z.string().optional().nullable(),
});

const updateSchema = z.object({ id: z.string().min(3), status: z.string() });
const deleteSchema = z.object({ id: z.string().min(3) });

function timeToMinutes(time) {
  const [hours, minutes] = (time || '').split(':').map((v) => Number(v));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

const DAY_KEYS_BY_INDEX = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getDayKey(dateString) {
  if (!dateString) return null;
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const dayIndex = typeof date.getUTCDay === 'function' ? date.getUTCDay() : date.getDay();
  return DAY_KEYS_BY_INDEX[dayIndex] || null;
}

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const reservations = await prisma.reservation.findMany({ orderBy: { createdAt: 'desc' } });
    return success({ reservations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse({ ...body, guests: Number(body.guests) });
    if (!parsed.success) return failure('Invalid reservation data', 400, { details: parsed.error.flatten() });

    const settings = await getRestaurantSettings();
    const workingHoursByDay = normalizeWorkingHoursByDay(
      settings.workingHoursByDay,
      settings.openingTime,
      settings.closingTime,
    );

    const reservationDayKey = getDayKey(parsed.data.date);
    const daySettings =
      workingHoursByDay.find((entry) => entry.day === reservationDayKey) ||
      workingHoursByDay.find((entry) => entry.day === DAYS_OF_WEEK[0]) ||
      {
        openingTime: settings.openingTime,
        closingTime: settings.closingTime,
        closed: false,
      };

    if (daySettings.closed) {
      return failure('Restaurant is closed on the selected day', 400);
    }
    const reservationMinutes = timeToMinutes(parsed.data.time);
    const openingMinutes = timeToMinutes(daySettings.openingTime ?? settings.openingTime);
    const closingMinutes = timeToMinutes(daySettings.closingTime ?? settings.closingTime);

    if (
      reservationMinutes === null ||
      openingMinutes === null ||
      closingMinutes === null ||
      reservationMinutes < openingMinutes ||
      reservationMinutes > closingMinutes
    ) {
      return failure('Restaurant is closed at this time', 400);
    }

    const reservation = await prisma.reservation.create({ data: parsed.data });
    return success({ reservation });
  } catch (error) {
    return failure('Unable to create reservation', 500);
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid reservation update', 400, { details: parsed.error.flatten() });

    const reservation = await prisma.reservation.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
    return success({ reservation });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid reservation id', 400);
    await prisma.reservation.delete({ where: { id: parsed.data.id } });
    return success({});
  } catch (error) {
    return handleApiError(error);
  }
}