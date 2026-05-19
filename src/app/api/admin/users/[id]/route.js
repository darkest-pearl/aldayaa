export const dynamic = "force-dynamic";
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

    const existing = await prisma.adminUser.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Admin user not found', 404);

    if (existing.role === 'ADMIN' && parsed.data.role && parsed.data.role !== 'ADMIN') {
      const adminCount = await prisma.adminUser.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return failure('Cannot demote the last remaining ADMIN user', 400);
      }
    }

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
    const currentAdmin = await requireAdmin(request, ['ADMIN']);
    if (currentAdmin.id === params.id) {
      return failure('Cannot delete the currently logged-in admin user', 400);
    }

    const existing = await prisma.adminUser.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Admin user not found', 404);

    if (existing.role === 'ADMIN') {
      const adminCount = await prisma.adminUser.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return failure('Cannot delete the last remaining ADMIN user', 400);
      }
    }

    await prisma.adminUser.delete({ where: { id: params.id } });
    return success({});
  } catch (error) {
    return handleApiError(error);
  }
}
