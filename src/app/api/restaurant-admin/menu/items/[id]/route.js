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
  .refine((value) => !value || value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://'), {
    message: 'Image must be a local path or a full URL',
  });

const updateSchema = z.object({
  restaurantSlug: z.string().min(1),
  name: z.string().trim().min(2).optional(),
  description: z.string().optional().nullable(),
  price: z.number().min(0).optional(),
  categoryId: z.string().min(1).optional(),
  isAvailable: z.boolean().optional(),
  recommended: z.boolean().optional(),
  isSignature: z.boolean().optional(),
  imageUrl: imagePathSchema.optional().nullable(),
});

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid item payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const existing = await prisma.menuItem.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!existing) return failure('Menu item not found', 404);

    if (parsed.data.categoryId !== undefined) {
      const category = await prisma.menuCategory.findFirst({
        where: { id: parsed.data.categoryId, restaurantId: staff.restaurantId },
        select: { id: true },
      });
      if (!category) return failure('Category not found', 404);
    }

    const data = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) data.description = normalizeOptionalText(parsed.data.description);
    if (parsed.data.price !== undefined) data.price = parsed.data.price;
    if (parsed.data.categoryId !== undefined) data.categoryId = parsed.data.categoryId;
    if (parsed.data.isAvailable !== undefined) data.isAvailable = parsed.data.isAvailable;
    if (parsed.data.recommended !== undefined) data.recommended = parsed.data.recommended;
    if (parsed.data.isSignature !== undefined) data.isSignature = parsed.data.isSignature;
    if (parsed.data.imageUrl !== undefined) data.imageUrl = normalizeOptionalText(parsed.data.imageUrl);

    const item = await prisma.menuItem.update({
      where: { id: params.id },
      data,
    });
    return success({ item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug, { write: true });
    const existing = await prisma.menuItem.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!existing) return failure('Menu item not found', 404);

    await prisma.menuItem.deleteMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });
    return success({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
