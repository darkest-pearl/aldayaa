export const dynamic = "force-dynamic";
import { z } from 'zod';
import { authenticateAdmin, setSessionCookie } from '../../../../lib/auth';
import { success, failure } from '../../../../lib/api-response';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Email and password are required', 400);
    }

    const admin = await authenticateAdmin(parsed.data.email, parsed.data.password);

    if (!admin) {
      return failure('Invalid credentials', 401);
    }
    const response = success({ admin: { id: admin.id, email: admin.email, role: admin.role } });
    setSessionCookie(response, admin);  

    return response;
  } catch (error) {
    return failure('Server error', 500);
  }
}
