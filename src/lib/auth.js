export const dynamic = "force-dynamic";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/** @typedef {import("@prisma/client").AdminUser} AdminUser */

/** Cookie name for admin sessions. */
export const COOKIE_NAME = "aldayaa_admin";
/** Token expiry duration. */
const TOKEN_EXPIRY = "7d";
const DEVELOPMENT_JWT_SECRET = "development-only-aldayaa-secret";

/**
 * Resolve the JWT signing secret safely.
 * Production must provide ADMIN_JWT_SECRET; development gets an explicit non-production fallback.
 * @returns {string}
 */
function getJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new AuthError(
      "ADMIN_JWT_SECRET must be configured in production and should be at least 32 characters long",
      500,
      "MISSING_JWT_SECRET",
    );
  }

  if (secret && secret.length < 32) {
    console.warn("ADMIN_JWT_SECRET is shorter than recommended; using development fallback outside production.");
  }

  return DEVELOPMENT_JWT_SECRET;
}

function getCookieDomain() {
  return process.env.NODE_ENV === "production" && process.env.COOKIE_DOMAIN
    ? process.env.COOKIE_DOMAIN
    : undefined;
}

/**
 * Role constants available to admin users.
 * @type {{ ADMIN: "ADMIN"; MANAGER: "MANAGER"; SUPPORT: "SUPPORT" }}
 */
export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  SUPPORT: "SUPPORT",
};

/**
 * Custom error to signal authorization failures.
 */
export class AuthError extends Error {
  /**
   * @param {string} message - Error message for the caller.
   * @param {number} [status=401] - HTTP status to respond with.
   * @param {string} [code="UNAUTHORIZED"] - Machine-readable error code.
   */
  constructor(message, status = 401, code = "UNAUTHORIZED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Create a signed JWT token for an admin.
 * @param {{ id: string; email: string; role: string }} admin - Admin payload to sign.
 * @returns {string} Signed JWT string.
 */
export function createToken(admin) {
  if (!admin?.id || !admin?.email || !admin?.role) {
    throw new AuthError("Invalid admin payload", 400, "INVALID_PAYLOAD");
  }

  return jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRY,
  });
}

/**
 * Attach a session cookie to the provided response.
 * @param {import("next/server").NextResponse} response - Response to mutate.
 * @param {{ id: string; email: string; role: string }} admin - Authenticated admin data.
 */
export function setSessionCookie(response, admin) {
  try {
    const token = createToken(admin);
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      domain: getCookieDomain(),
    });
  } catch (error) {
    console.error("Failed to set session cookie", error);
    throw error;
  }
}

/**
 * Clear the admin session cookie.
 * @param {import("next/server").NextResponse} response - Response to mutate.
 */
export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    domain: getCookieDomain(),
  });
}

/**
 * Extract admin details from the incoming request cookies.
 * @param {import("next/server").NextRequest | { cookies?: { get?: Function }}} request - Request object with cookies helper.
 * @returns {Promise<{ id: string; email: string; role: string } | null>} Verified admin payload or null.
 */
export async function getAdminFromRequest(request) {
  const cookieSource = request?.cookies?.get
    ? request.cookies
    : request?.get
      ? request
      : null;

  const token = cookieSource?.get?.(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (!payload?.id || !payload?.email || !payload?.role) return null;
    return payload;
  } catch (error) {
    console.warn("Invalid admin token", error);
    return null;
  }
}

/**
 * Ensure a request is authenticated as an admin with optional role restriction.
 * @param {import("next/server").NextRequest} request - Incoming request instance.
 * @param {string[]} [allowedRoles=[]] - Allowed role list.
 * @returns {Promise<{ id: string; email: string; role: string }>} Validated admin payload.
 * @throws {AuthError} When authentication or authorization fails.
 */
export async function requireAdmin(request, allowedRoles = []) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    throw new AuthError("Unauthorized", 401, "UNAUTHORIZED");
  }

  if (allowedRoles.length && !allowedRoles.includes(admin.role)) {
    throw new AuthError("Forbidden", 403, "FORBIDDEN");
  }
  return admin;
}

/**
 * Authenticate an admin user's credentials.
 * @param {string} email - Admin email.
 * @param {string} password - Plain text password to verify.
 * @returns {Promise<{ id: string; email: string; role: string } | null>} Public admin data or null.
 */
export async function authenticateAdmin(email, password) {
  if (!email || !password) {
    return null;
  }

  try {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) return null;

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return null;
    return { id: user.id, email: user.email, role: user.role };
  } catch (error) {
    console.error("Failed to authenticate admin", error);
    return null;
  }
}

/**
 * Hash a password using bcrypt.
 * @param {string} password - Plain text password to hash.
 * @returns {Promise<string>} Hashed password string.
 */
export async function hashPassword(password) {
  if (!password) {
    throw new AuthError("Password is required", 400, "INVALID_PASSWORD");
  }
  return bcrypt.hash(password, 10);
}
