export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';

const categorySchema = z.object({
  restaurantSlug: z.string().min(1),
  name: z.string().trim().min(2),
});

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const categories = await prisma.galleryCategory.findMany({
      where: { restaurantId: staff.restaurantId },
      include: {
        photos: {
          where: { restaurantId: staff.restaurantId },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return success({ categories, staffRole: staff.role });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid gallery category payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const category = await prisma.galleryCategory.create({
      data: {
        restaurantId: staff.restaurantId,
        name: parsed.data.name,
      },
    });
    return success({ category });
  } catch (error) {
    return handleApiError(error);
  }
}
