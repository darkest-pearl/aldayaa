import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'aldayaa-secret';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const cookie = request.cookies.get('aldayaa_admin');
    if (!cookie) {
      const url = new URL('/admin/login', request.url);
      return NextResponse.redirect(url);
    }
    try {
      jwt.verify(cookie.value, JWT_SECRET);
    } catch (e) {
      const url = new URL('/admin/login', request.url);
      return NextResponse.redirect(url);
    }
  }
  if (pathname.startsWith('/api') && pathname.includes('/admin') && pathname !== '/api/admin/login') {
    const cookie = request.cookies.get('aldayaa_admin');
    if (!cookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      jwt.verify(cookie.value, JWT_SECRET);
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};