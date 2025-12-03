import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';

const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url(),
  categoryId: z.string().min(3),
});

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const photos = await prisma.photo.findMany({ include: { category: true } });
    return success({ photos });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return failure('Invalid photo payload', 400, { details: parsed.error.flatten() });
    const photo = await prisma.photo.create({ data: parsed.data });
    return success({ photo });
  } catch (error) {
    return handleApiError(error);
  }
}