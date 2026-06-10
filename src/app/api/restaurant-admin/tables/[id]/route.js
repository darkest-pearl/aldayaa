export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import { normalizeTable } from '../../../../../lib/tables';

const updateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  label: z.string().trim().min(1).max(80).optional(),
  seats: z.number().int().min(1).max(999).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

function buildTenantTableOrderUrl(table, restaurantSlug) {
  const tokenQuery = table.qrToken ? `?token=${encodeURIComponent(table.qrToken)}` : '';
  return table.isActive && table.slug
    ? `/r/${encodeURIComponent(restaurantSlug)}/table/${encodeURIComponent(table.slug)}${tokenQuery}`
    : '';
}

function normalizeTenantTable(table, restaurantSlug) {
  const normalized = normalizeTable(table);
  return {
    ...normalized,
    qrToken: normalized.qrToken,
    orderUrl: buildTenantTableOrderUrl(normalized, restaurantSlug),
  };
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid table payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });

    if (parsed.data.label !== undefined) {
      const duplicate = await prisma.restaurantTable.findFirst({
        where: {
          restaurantId: staff.restaurantId,
          label: parsed.data.label,
          NOT: { id: params.id },
        },
        select: { id: true },
      });
      if (duplicate) return failure('Table label already exists for this restaurant', 409);
    }

    const data = {};
    if (parsed.data.label !== undefined) data.label = parsed.data.label;
    if (parsed.data.seats !== undefined) data.seats = parsed.data.seats ?? null;
    if (parsed.data.zone !== undefined) data.zone = normalizeOptionalText(parsed.data.zone);
    if (parsed.data.notes !== undefined) data.notes = normalizeOptionalText(parsed.data.notes);
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

    const updated = await prisma.restaurantTable.updateMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
      data,
    });

    if (updated.count !== 1) return failure('Table not found', 404);

    const table = await prisma.restaurantTable.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });
    if (!table) return failure('Table not found', 404);

    return success({ table: normalizeTenantTable(table, parsed.data.restaurantSlug) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug, { write: true });
    const updated = await prisma.restaurantTable.updateMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
      data: { isActive: false },
    });

    if (updated.count !== 1) return failure('Table not found', 404);

    const table = await prisma.restaurantTable.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });
    if (!table) return failure('Table not found', 404);

    return success({ table: normalizeTenantTable(table, restaurantSlug) });
  } catch (error) {
    return handleApiError(error);
  }
}
