import { z } from 'zod';
import { prisma } from '../../../../../lib/prisma';
import { hashPassword, requireAdmin } from '../../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../../lib/api-response';

const updateSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'SUPPORT']).optional(),
  password: z.string().min(6).optional(),
});

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid admin payload', 400, { details: parsed.error.flatten() });

    const data = { ...parsed.data };
    if (data.password) {
      data.passwordHash = await hashPassword(data.password);
      delete data.password;
    }
    const admin = await prisma.adminUser.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, role: true },
    });
    return success({ admin });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN']);
    await prisma.adminUser.delete({ where: { id: params.id } });
    return success({});
  } catch (error) {
    return handleApiError(error);
  }
}