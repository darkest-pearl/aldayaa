import jwt from 'jsonwebtoken';
import { DEMO_RESTAURANT_SLUG } from './restaurants';

export const RESTAURANT_STAFF_COOKIE_NAME = 'aldayaa_restaurant_staff';
export const RESTAURANT_STAFF_TOKEN_TYPE = 'restaurant_staff';
const TOKEN_EXPIRY = '7d';
const DEVELOPMENT_RESTAURANT_STAFF_JWT_SECRET = 'development-only-restaurant-staff-secret';

export const RESTAURANT_STAFF_ROLES = Object.freeze({
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  SUPPORT: 'SUPPORT',
});

export const RESTAURANT_STAFF_ROLE_VALUES = Object.freeze(Object.values(RESTAURANT_STAFF_ROLES));

function getCookieDomain() {
  return process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
    ? process.env.COOKIE_DOMAIN
    : undefined;
}

function getRestaurantStaffJwtSecret() {
  const staffSecret = process.env.RESTAURANT_STAFF_JWT_SECRET;
  if (staffSecret && staffSecret.length >= 32) return staffSecret;

  const adminFallback = process.env.ADMIN_JWT_SECRET;
  if (adminFallback && adminFallback.length >= 32) return adminFallback;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('RESTAURANT_STAFF_JWT_SECRET must be configured in production and should be at least 32 characters long');
  }

  return DEVELOPMENT_RESTAURANT_STAFF_JWT_SECRET;
}

export function isValidRestaurantStaffRole(role) {
  return RESTAURANT_STAFF_ROLE_VALUES.includes(role);
}

export function normalizeRestaurantStaffEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function createRestaurantStaffTokenPayload(staffUser) {
  if (
    !staffUser?.id ||
    !staffUser?.restaurantId ||
    !staffUser?.restaurantSlug ||
    !staffUser?.email ||
    !staffUser?.role
  ) {
    throw new Error('Invalid restaurant staff payload');
  }

  if (!isValidRestaurantStaffRole(staffUser.role)) {
    throw new Error('Invalid restaurant staff payload');
  }

  return {
    tokenType: 'restaurant_staff',
    id: staffUser.id,
    restaurantId: staffUser.restaurantId,
    restaurantSlug: staffUser.restaurantSlug,
    email: normalizeRestaurantStaffEmail(staffUser.email),
    role: staffUser.role,
  };
}

export function createRestaurantStaffToken(staffUser) {
  return jwt.sign(createRestaurantStaffTokenPayload(staffUser), getRestaurantStaffJwtSecret(), {
    expiresIn: TOKEN_EXPIRY,
  });
}

export function verifyRestaurantStaffToken(token) {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getRestaurantStaffJwtSecret());
    if (payload?.tokenType !== RESTAURANT_STAFF_TOKEN_TYPE) return null;
    return createRestaurantStaffTokenPayload(payload);
  } catch (error) {
    return null;
  }
}

export function setRestaurantStaffSessionCookie(response, staffUser) {
  const token = createRestaurantStaffToken(staffUser);
  response.cookies.set(RESTAURANT_STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    domain: getCookieDomain(),
  });
}

export function clearRestaurantStaffSessionCookie(response) {
  response.cookies.set(RESTAURANT_STAFF_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    domain: getCookieDomain(),
  });
}

export async function getRestaurantStaffFromRequest(request) {
  const cookieSource = request?.cookies?.get
    ? request.cookies
    : request?.get
      ? request
      : null;

  const token = cookieSource?.get?.(RESTAURANT_STAFF_COOKIE_NAME)?.value;
  return verifyRestaurantStaffToken(token);
}

export async function authenticateRestaurantStaff(restaurantSlug, email, password) {
  const [{ default: bcrypt }, { prisma }] = await Promise.all([
    import('bcryptjs'),
    import('./prisma'),
  ]);
  const cleanSlug = typeof restaurantSlug === 'string' ? restaurantSlug.trim().toLowerCase() : '';
  const cleanEmail = normalizeRestaurantStaffEmail(email);

  if (!cleanSlug || restaurantSlug === DEMO_RESTAURANT_SLUG || cleanSlug === DEMO_RESTAURANT_SLUG || !cleanEmail || !password) {
    return null;
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: cleanSlug },
    select: { id: true, slug: true, status: true },
  });

  if (!restaurant || restaurant.status === 'ARCHIVED') {
    return null;
  }

  const staffUser = await prisma.restaurantUser.findUnique({
    where: {
      restaurantId_email: {
        restaurantId: restaurant.id,
        email: cleanEmail,
      },
    },
  });

  if (!staffUser || !staffUser.isActive || !isValidRestaurantStaffRole(staffUser.role)) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, staffUser.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  await prisma.restaurantUser.update({
    where: { id: staffUser.id },
    data: { lastLoginAt: new Date() },
  });

  return createRestaurantStaffTokenPayload({
    id: staffUser.id,
    restaurantId: staffUser.restaurantId,
    restaurantSlug: restaurant.slug,
    email: staffUser.email,
    role: staffUser.role,
  });
}

export async function hashRestaurantStaffPassword(password) {
  const { default: bcrypt } = await import('bcryptjs');

  if (typeof password !== 'string' || password.length < 10) {
    throw new Error('Restaurant staff password must be at least 10 characters long');
  }

  return bcrypt.hash(password, 10);
}
