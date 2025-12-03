import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';

const schema = z.object({ name: z.string().min(2) });

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const categories = await prisma.galleryCategory.findMany({ include: { photos: true }, orderBy: { createdAt: 'asc' } });
    return success({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return failure('Invalid category payload', 400, { details: parsed.error.flatten() });
    const category = await prisma.galleryCategory.create({ data: { name: parsed.data.name } });
    return success({ category });
  } catch (error) {
    return handleApiError(error);
  }
}