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
  .refine((value) => !value || value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://'), {
    message: 'Image must be a local path or a full URL',
  });

const itemSchema = z.object({
  restaurantSlug: z.string().min(1),
  name: z.string().trim().min(2),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  categoryId: z.string().min(1),
  isAvailable: z.boolean().optional(),
  recommended: z.boolean().optional(),
  isSignature: z.boolean().optional(),
  imageUrl: imagePathSchema.optional().nullable(),
});

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const items = await prisma.menuItem.findMany({
      where: { restaurantId: staff.restaurantId },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    return success({ items, staffRole: staff.role });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid item payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const category = await prisma.menuCategory.findFirst({
      where: { id: parsed.data.categoryId, restaurantId: staff.restaurantId },
      select: { id: true },
    });
    if (!category) return failure('Category not found', 404);

    const item = await prisma.menuItem.create({
      data: {
        restaurantId: staff.restaurantId,
        name: parsed.data.name,
        description: normalizeOptionalText(parsed.data.description),
        price: parsed.data.price,
        categoryId: parsed.data.categoryId,
        isAvailable: parsed.data.isAvailable !== false,
        recommended: Boolean(parsed.data.recommended),
        isSignature: Boolean(parsed.data.isSignature),
        imageUrl: normalizeOptionalText(parsed.data.imageUrl),
      },
    });
    return success({ item });
  } catch (error) {
    return handleApiError(error);
  }
}
