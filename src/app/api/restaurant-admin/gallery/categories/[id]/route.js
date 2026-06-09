export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { prisma } from '../../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../../../lib/restaurant-staff-access';

const updateSchema = z.object({
  restaurantSlug: z.string().min(1),
  name: z.string().trim().min(2).optional(),
});

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid gallery category payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await prisma.galleryCategory.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!existing) return failure('Gallery category not found', 404);

    const category = await prisma.galleryCategory.update({
      where: { id: params.id },
      data: parsed.data.name !== undefined ? { name: parsed.data.name } : {},
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
    const existing = await prisma.galleryCategory.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!existing) return failure('Gallery category not found', 404);

    await prisma.photo.deleteMany({
      where: { categoryId: params.id, restaurantId: staff.restaurantId },
    });
    await prisma.galleryCategory.deleteMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });
    return success({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
