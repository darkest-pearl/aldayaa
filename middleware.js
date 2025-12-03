export const runtime = "nodejs";            

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "aldayaa_admin";
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "aldayaa-secret";

const PUBLIC_PATHS = ["/admin/login", "/api/admin/login", "/admin/logout", "/api/admin/logout"];

function isPublic(pathname) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PATHS.some((p) => pathname.startsWith(p + "/"));
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const isAdminSection = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!isAdminSection) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let session = null;

  if (token) {
    try {
      session = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      session = null;
    }
  }

  if (isPublic(pathname)) {
    if (session && pathname.startsWith("/admin/login")) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
