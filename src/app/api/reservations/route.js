import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
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