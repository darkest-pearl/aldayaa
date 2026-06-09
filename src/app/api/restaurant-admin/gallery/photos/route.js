export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';

const imagePathSchema = z
  .string()
  .trim()
  .refine((value) => value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://'), {
    message: 'Image must be a local path or a full URL',
  });

const photoSchema = z.object({
  restaurantSlug: z.string().min(1),
  title: z.string().trim().min(2),
  description: z.string().optional().nullable(),
  imageUrl: imagePathSchema,
  categoryId: z.string().min(1),
});

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const photos = await prisma.photo.findMany({
      where: { restaurantId: staff.restaurantId },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    return success({ photos, staffRole: staff.role });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = photoSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid photo payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const category = await prisma.galleryCategory.findFirst({
      where: { id: parsed.data.categoryId, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!category) return failure('Gallery category not found', 404);

    const photo = await prisma.photo.create({
      data: {
        restaurantId: staff.restaurantId,
        title: parsed.data.title,
        description: normalizeOptionalText(parsed.data.description),
        imageUrl: parsed.data.imageUrl,
        categoryId: parsed.data.categoryId,
      },
    });
    return success({ photo });
  } catch (error) {
    return handleApiError(error);
  }
}
