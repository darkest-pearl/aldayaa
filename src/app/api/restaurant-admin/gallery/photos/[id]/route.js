export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../../lib/api-response';
import { prisma } from '../../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../../lib/restaurant-staff-access';

const imagePathSchema = z
  .string()
  .trim()
  .refine((value) => value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://'), {
    message: 'Image must be a local path or a full URL',
  });

const updateSchema = z.object({
  restaurantSlug: z.string().min(1),
  title: z.string().trim().min(2).optional(),
  description: z.string().optional().nullable(),
  imageUrl: imagePathSchema.optional(),
  categoryId: z.string().min(1).optional(),
});

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid photo payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await prisma.photo.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!existing) return failure('Photo not found', 404);

    if (parsed.data.categoryId !== undefined) {
      const category = await prisma.galleryCategory.findFirst({
        where: { id: parsed.data.categoryId, restaurantId: staff.restaurantId },
        select: { id: true },
      });
      if (!category) return failure('Gallery category not found', 404);
    }

    const data = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.description !== undefined) data.description = normalizeOptionalText(parsed.data.description);
    if (parsed.data.imageUrl !== undefined) data.imageUrl = parsed.data.imageUrl;
    if (parsed.data.categoryId !== undefined) data.categoryId = parsed.data.categoryId;

    const photo = await prisma.photo.update({
      where: { id: params.id },
      data,
    });
    return success({ photo });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug, { write: true });
    const existing = await prisma.photo.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!existing) return failure('Photo not found', 404);

    await prisma.photo.deleteMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });
    return success({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
