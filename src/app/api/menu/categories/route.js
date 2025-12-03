import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});
export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const categories = await prisma.menuCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { items: true } });
    return success({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid category payload', 400, { details: parsed.error.flatten() });
    }
    const category = await prisma.menuCategory.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || '',
        sortOrder: parsed.data.sortOrder || 0,
      },
    });
    return success({ category });
  } catch (error) {
    return handleApiError(error
    );
  }
}