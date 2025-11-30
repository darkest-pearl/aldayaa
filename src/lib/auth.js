import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'aldayaa-secret';

export async function verifyAdmin(request) {
  const cookie = request.cookies.get('aldayaa_admin');
  if (!cookie) return null;
  try {
    const decoded = jwt.verify(cookie.value, JWT_SECRET);
    return decoded;
  } catch (e) {
    return null;
  }
}

export async function requireAdmin(request) {
  const admin = await verifyAdmin(request);
  if (!admin) throw new Error('Unauthorized');
  return admin;
}

export async function authenticateAdmin(email, password) {
  const envEmail = process.env.ADMIN_EMAIL;
  const envPassword = process.env.ADMIN_PASSWORD;

  if (envEmail && envPassword && email === envEmail && password === envPassword) {
    return { id: 'env-admin', email };
  }

  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return null;
  return { id: user.id, email: user.email };
}

export function setSessionCookie(response, admin) {
  const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });
  response.cookies.set('aldayaa_admin', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
}