export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "aldayaa_admin";
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "aldayaa-secret";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow login and auth APIs
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/api/admin/login")) {
    return NextResponse.next();
  }

  // Protect /admin pages
  if (pathname.startsWith("/admin")) {
    const cookie = request.cookies.get(COOKIE_NAME);

    if (!cookie) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      jwt.verify(cookie.value, JWT_SECRET);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
