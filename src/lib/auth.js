import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE_NAME = "aldayaa_admin";
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "aldayaa-secret";
const TOKEN_EXPIRY = "7d";

export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  SUPPORT: "SUPPORT",
};

export class AuthError extends Error {
  constructor(message, status = 401, code = "UNAUTHORIZED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function setSessionCookie(response, admin) {
  const token = createToken(admin);
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    domain: process.env.NODE_ENV === "production" ? process.env.COOKIE_DOMAIN : undefined,
  });
}

export async function getAdminFromRequest(request) {
  const cookieSource =
    request?.cookies?.get
      ? request.cookies
      : request?.get
      ? request
      : null;

  const token = cookieSource?.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function requireAdmin(request, allowedRoles = []) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    throw new AuthError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (allowedRoles.length && !allowedRoles.includes(admin.role)) {
    throw new AuthError('Forbidden', 403, 'FORBIDDEN');
  }
  return admin;
}

export async function authenticateAdmin(email, password) {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return null;

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return null;
  return { id: user.id, email: user.email, role: user.role };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}