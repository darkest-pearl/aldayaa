export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  RESTAURANT_STAFF_COOKIE_NAME,
  verifyRestaurantStaffToken,
} from './src/lib/restaurant-staff-auth';

const ADMIN_COOKIE_NAME = 'aldayaa_admin';
const DEVELOPMENT_ADMIN_JWT_SECRET = 'development-only-aldayaa-secret';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/api/admin/login', '/admin/logout', '/api/admin/logout'];

function getAdminJwtSecret() {
  return process.env.ADMIN_JWT_SECRET || DEVELOPMENT_ADMIN_JWT_SECRET;
}

function isPublicAdminPath(pathname) {
  return PUBLIC_ADMIN_PATHS.includes(pathname) || PUBLIC_ADMIN_PATHS.some((path) => pathname.startsWith(`${path}/`));
}

function getTenantAdminRoute(pathname) {
  const match = pathname.match(/^\/r\/([^/]+)\/admin(?:\/(.*))?$/);
  if (!match) return null;

  return {
    restaurantSlug: match[1],
    childPath: match[2] || '',
  };
}

function isTenantAdminRoute(pathname) {
  return Boolean(getTenantAdminRoute(pathname));
}

function getPlatformAdminSession(request) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return jwt.verify(token, getAdminJwtSecret());
  } catch (error) {
    return null;
  }
}

function handleTenantAdminRoute(request) {
  const route = getTenantAdminRoute(request.nextUrl.pathname);
  const restaurantSlug = route.restaurantSlug;
  const isLogin = route.childPath === 'login';
  const token = request.cookies.get(RESTAURANT_STAFF_COOKIE_NAME)?.value;
  const session = verifyRestaurantStaffToken(token);

  if (!session || session.restaurantSlug !== restaurantSlug) {
    if (isLogin) return NextResponse.next();
    return NextResponse.redirect(new URL(`/r/${restaurantSlug}/admin/login`, request.url));
  }

  if (isLogin) {
    return NextResponse.redirect(new URL(`/r/${restaurantSlug}/admin`, request.url));
  }

  return NextResponse.next();
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const isAdminSection = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  if (isTenantAdminRoute(pathname)) {
    return handleTenantAdminRoute(request);
  }

  if (!isAdminSection) {
    return NextResponse.next();
  }

  const session = getPlatformAdminSession(request);

  if (isPublicAdminPath(pathname)) {
    if (session && pathname.startsWith('/admin/login')) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/r/:restaurantSlug/admin/:path*"],
};
