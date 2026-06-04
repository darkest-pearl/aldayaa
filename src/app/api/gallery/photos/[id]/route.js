export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../../../lib/prisma';
import { requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../../lib/api-response';
import { withDemoRestaurantData, withDemoRestaurantWhere } from '../../../../../lib/restaurants';

const updateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional(),
  categoryId: z.string().optional(),
});

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid photo payload', 400, { details: parsed.error.flatten() });
    const existing = await prisma.photo.findFirst({ where: withDemoRestaurantWhere({ id: params.id }) });
    if (!existing) return failure('Photo not found', 404);

    if (parsed.data.categoryId !== undefined) {
      const category = await prisma.galleryCategory.findFirst({
        where: withDemoRestaurantWhere({ id: parsed.data.categoryId }),
        select: { id: true },
      });
      if (!category) return failure('Gallery category not found', 404);
    }

    const photo = await prisma.photo.update({
      where: { id: params.id },
      data: withDemoRestaurantData(parsed.data),
    });
    return success({ photo });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const existing = await prisma.photo.findFirst({ where: withDemoRestaurantWhere({ id: params.id }) });
    if (!existing) return failure('Photo not found', 404);

    await prisma.photo.deleteMany({ where: withDemoRestaurantWhere({ id: params.id }) });
    return success({});
  } catch (error) {
    return handleApiError(error);
  }
}
