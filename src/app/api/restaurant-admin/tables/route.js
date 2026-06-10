export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';
import {
  generateQrToken,
  generateTableSlug,
  normalizeTable,
} from '../../../../lib/tables';

const tableSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  label: z.string().trim().min(1).max(80),
  seats: z.number().int().min(1).max(999).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

function normalizeTenantTable(table) {
  const normalized = normalizeTable(table);
  return {
    ...normalized,
    qrToken: normalized.qrToken,
    orderUrl: '',
  };
}

async function generateUniqueSlug(label) {
  const baseSlug = generateTableSlug(label);
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.restaurantTable.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function generateUniqueQrToken() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const qrToken = generateQrToken();
    const existing = await prisma.restaurantTable.findUnique({
      where: { qrToken },
      select: { id: true },
    });
    if (!existing) return qrToken;
  }

  throw new Error('Unable to generate unique table token');
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId: staff.restaurantId },
      orderBy: [{ isActive: 'desc' }, { zone: 'asc' }, { label: 'asc' }],
    });

    return success({
      tables: tables.map((table) => normalizeTenantTable(table)),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = tableSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid table payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existingLabel = await prisma.restaurantTable.findFirst({
      where: { restaurantId: staff.restaurantId, label: parsed.data.label },
      select: { id: true },
    });
    if (existingLabel) return failure('Table label already exists for this restaurant', 409);

    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId: staff.restaurantId,
        label: parsed.data.label,
        slug: await generateUniqueSlug(parsed.data.label),
        qrToken: await generateUniqueQrToken(),
        seats: parsed.data.seats ?? null,
        zone: normalizeOptionalText(parsed.data.zone),
        notes: normalizeOptionalText(parsed.data.notes),
        isActive: parsed.data.isActive ?? true,
      },
    });

    return success({ table: normalizeTenantTable(table) });
  } catch (error) {
    return handleApiError(error);
  }
}
