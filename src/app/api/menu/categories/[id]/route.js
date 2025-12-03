import { z } from 'zod';
import { prisma } from '../../../../../lib/prisma';
import { requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../../lib/api-response';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid category payload', 400, { details: parsed.error.flatten() });

    const category = await prisma.menuCategory.update({ where: { id: params.id }, data: parsed.data });
    return success({ category });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    await prisma.menuItem.deleteMany({ where: { categoryId: params.id } });
    await prisma.menuCategory.delete({ where: { id: params.id } });
    return success({});
  } catch (error) {
    return handleApiError(error);
  }
}