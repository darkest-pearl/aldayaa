export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';

const itemSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  categoryId: z.string().min(3),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
  recommended: z.boolean().optional(),
});

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const items = await prisma.menuItem.findMany({ include: { category: true } });
    return success({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid item payload', 400, { details: parsed.error.flatten() });

    const item = await prisma.menuItem.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || '',
        price: parsed.data.price,
        categoryId: parsed.data.categoryId,
        isAvailable: parsed.data.isAvailable !== false,
        imageUrl: parsed.data.imageUrl || null,
        recommended: Boolean(parsed.data.recommended),
      },
    });
    return success({ item });
  } catch (error) {
    return handleApiError(error);
  }
}