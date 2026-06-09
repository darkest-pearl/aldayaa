export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { prisma } from '../../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../../lib/restaurant-staff-access';

const updateSchema = z.object({
  restaurantSlug: z.string().min(1),
  name: z.string().trim().min(2).optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid category payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await prisma.menuCategory.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!existing) return failure('Category not found', 404);

    const data = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) data.description = normalizeOptionalText(parsed.data.description);
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

    const category = await prisma.menuCategory.update({
      where: { id: params.id },
      data,
    });
    return success({ category });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug, { write: true });
    const existing = await prisma.menuCategory.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!existing) return failure('Category not found', 404);

    await prisma.menuItem.deleteMany({
      where: { categoryId: params.id, restaurantId: staff.restaurantId },
    });
    await prisma.menuCategory.deleteMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });
    return success({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
