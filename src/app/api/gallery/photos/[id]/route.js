export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../../../lib/prisma';
import { requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../../lib/api-response';

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
    const photo = await prisma.photo.update({ where: { id: params.id }, data: parsed.data });
    return success({ photo });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    await prisma.photo.delete({ where: { id: params.id } });
    return success({});
  } catch (error) {
    return handleApiError(error);
  }
}