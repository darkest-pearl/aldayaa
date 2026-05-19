export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import { normalizeTable } from '../../../../../lib/tables';

const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  seats: z.number().int().min(1).max(999).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getBaseUrl(request) {
  return process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl?.origin || '';
}

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid table payload', 400, { details: parsed.error.flatten() });
    }

    const existing = await prisma.restaurantTable.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Table not found', 404);

    const table = await prisma.restaurantTable.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.label !== undefined ? { label: parsed.data.label.trim() } : {}),
        ...(parsed.data.seats !== undefined ? { seats: parsed.data.seats ?? null } : {}),
        ...(parsed.data.zone !== undefined ? { zone: cleanOptionalString(parsed.data.zone) } : {}),
        ...(parsed.data.notes !== undefined ? { notes: cleanOptionalString(parsed.data.notes) } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    return success({ table: normalizeTable(table, getBaseUrl(request)) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const existing = await prisma.restaurantTable.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Table not found', 404);

    const table = await prisma.restaurantTable.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return success({ table: normalizeTable(table, getBaseUrl(request)) });
  } catch (error) {
    return handleApiError(error);
  }
}
