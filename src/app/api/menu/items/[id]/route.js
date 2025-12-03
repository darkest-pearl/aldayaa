import { z } from 'zod';
import { prisma } from '../../../../../lib/prisma';
import { requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../../lib/api-response';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  price: z.number().min(0).optional(),
  categoryId: z.string().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
});

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid item payload', 400, { details: parsed.error.flatten() });

    const item = await prisma.menuItem.update({ where: { id: params.id }, data: parsed.data });
    return success({ item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    await prisma.menuItem.delete({ where: { id: params.id } });
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
  } catch (error) {
    return handleApiError(error);
  }
}