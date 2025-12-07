export const dynamic = "force-dynamic";
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { hashPassword, requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'SUPPORT']),
});

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, role: true } });
    return success({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN']);
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return failure('Invalid admin payload', 400, { details: parsed.error.flatten() });

    const existing = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return failure('Admin with this email already exists', 400);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const admin = await prisma.adminUser.create({
      data: { email: parsed.data.email, passwordHash, role: parsed.data.role },
      select: { id: true, email: true, role: true },
    });
    return success({ admin });
  } catch (error) {
    return handleApiError(error);
  }
}